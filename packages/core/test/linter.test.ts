import { describe, expect, it } from "vitest";
import { compilePrompt, extractScriptedLines, lintPrompt, lintSpokenLine, type LintRuleId } from "../src";

const rules = (issues: { rule: LintRuleId }[]) => issues.map((i) => i.rule);

const SAFE = [
  "Calls only happen between 8am and 9pm West Africa Time.",
  "If they ask not to be called again, record the opt-out.",
  "You are an AI voice assistant.",
  "Never ask for a PIN, OTP, BVN or card number.",
].join("\n");

describe("lintSpokenLine", () => {
  it("flags more than one question per turn", () => {
    expect(rules(lintSpokenLine("How are you? Is now a good time?"))).toContain("one-question-per-turn");
    expect(rules(lintSpokenLine("Is now a good time?"))).not.toContain("one-question-per-turn");
  });

  it("flags symbols a voice would read aloud but not {{placeholders}}", () => {
    const issue = lintSpokenLine("Rates/fees & charges apply *today*").find((i) => i.rule === "spoken-symbols");
    expect(issue?.message).toMatch(/\/ & \*/);
    expect(lintSpokenLine("Hello {{address}}, welcome.")).toEqual([]);
  });

  it("flags Sir/Ma next to a name or title", () => {
    expect(rules(lintSpokenLine("Thank you Mr Okafor Sir."))).toContain("sir-ma-placement");
  });

  it("suggests 'outside business hours'", () => {
    expect(lintSpokenLine("We are closed after hours.")[0]).toMatchObject({ rule: "after-hours-wording", suggestion: "outside business hours" });
  });
});

describe("extractScriptedLines", () => {
  it("finds quoted lines and Say: lines with line numbers", () => {
    const lines = extractScriptedLines('Intro\nSay "Hello there, how are you?"\nSay: Thanks for your time.\nshort "ok"');
    expect(lines).toEqual([
      { text: "Hello there, how are you?", line: 2 },
      { text: "Thanks for your time.", line: 3 },
    ]);
  });
});

describe("lintPrompt", () => {
  it("passes a safe prompt", () => {
    expect(lintPrompt({ prompt: SAFE })).toEqual({ issues: [], counts: { error: 0, warning: 0, info: 0 }, score: 100 });
  });

  it("flags each missing guardrail as an error", () => {
    const r = lintPrompt({ prompt: "You are a sales agent. Sell hard." });
    expect(rules(r.issues)).toEqual(
      expect.arrayContaining(["missing-opt-out", "missing-ai-disclosure", "missing-calling-hours", "missing-data-safety"]),
    );
    expect(r.counts.error).toBe(4);
    expect(r.score).toBe(0);
  });

  it("lints scripted lines and the first message", () => {
    const r = lintPrompt({
      prompt: `${SAFE}\nOpen with "Hi, how are you? Do you have a minute?"`,
      firstMessage: "Hello / welcome",
    });
    expect(r.issues.find((i) => i.rule === "one-question-per-turn")?.line).toBe(5);
    expect(rules(r.issues)).toContain("spoken-symbols");
  });

  it("warns, then errors, as the prompt grows", () => {
    expect(rules(lintPrompt({ prompt: SAFE + "x".repeat(7000) }).issues)).toContain("prompt-too-long");
    expect(lintPrompt({ prompt: SAFE + "x".repeat(7000) }).issues.find((i) => i.rule === "prompt-too-long")?.severity).toBe("warning");
    expect(lintPrompt({ prompt: SAFE + "x".repeat(13000) }).issues.find((i) => i.rule === "prompt-too-long")?.severity).toBe("error");
    expect(lintPrompt({ prompt: SAFE + "x".repeat(400) }, { warnTokens: 100 }).issues.map((i) => i.rule)).toContain("prompt-too-long");
  });

  it("flags repeated lines", () => {
    const line = "Always confirm the appointment date and time.";
    const r = lintPrompt({ prompt: `${SAFE}\n${line}\n${line}` });
    expect(r.issues.find((i) => i.rule === "repeated-line")).toMatchObject({ line: 6, message: "This line repeats line 5." });
  });

  it("flags 'after hours' anywhere in the prompt", () => {
    expect(rules(lintPrompt({ prompt: `${SAFE}\nIf they call after-hours, take a message.` }).issues)).toEqual(["after-hours-wording"]);
  });

  it("is satisfied by the compiler's injected guardrails", () => {
    const compiled = compilePrompt({ blocks: [{ id: "a", section: "beginning", title: "A", content: "Be kind." }], variables: [], firstMessage: "Hello." });
    expect(lintPrompt({ prompt: compiled.prompt, firstMessage: compiled.firstMessage }).counts.error).toBe(0);
  });
});
