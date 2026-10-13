import { describe, expect, it } from "vitest";
import {
  buildCallValues,
  compilePrompt,
  DEFAULT_GUARDRAILS,
  findVariables,
  fromLagosParts,
  renderVariables,
  type PromptTemplate,
} from "../src";

const template: PromptTemplate = {
  firstMessage: "{{greeting}}, {{address}}. My name is {{agent_name}} from {{company_name}}. Is this a good time?",
  variables: [
    { name: "company_name", label: "Company", scope: "agent", required: true },
    { name: "agent_name", label: "Agent", scope: "agent", required: true, defaultValue: "Zara" },
    { name: "lead_name", label: "Lead", scope: "call", required: false },
  ],
  blocks: [
    { id: "end1", section: "end", part: "goodbye", title: "Goodbye", content: "Say {{goodbye}}" },
    { id: "b3", section: "body", part: "reassure", title: "Reassure", content: "Reassure them." },
    { id: "b1", section: "body", part: "understand", title: "Understand", content: "Ask about the problem." },
    { id: "start", section: "beginning", title: "Identity", content: "You are {{agent_name}} for {{company_name}}." },
    { id: "b2", section: "body", part: "solution", title: "Solution", content: "Explain the solution." },
    { id: "adj", section: "adjunct", title: "Context", content: "Speak warmly to {{lead_name}}." },
    { id: "off", section: "adjunct", title: "Disabled", content: "SHOULD NOT APPEAR", enabled: false },
  ],
};

describe("variables", () => {
  it("finds and renders {{placeholders}}", () => {
    expect(findVariables("Hi {{ a }} and {{b}} and {{a}}")).toEqual(["a", "b"]);
    expect(renderVariables("Hi {{a}} {{b}}", { a: "Ada", b: "" })).toBe("Hi Ada {{b}}");
  });
});

describe("compilePrompt", () => {
  it("orders sections by the five-part framework and body phases in order", () => {
    const r = compilePrompt(template, { values: { company_name: "Spag Finance" } });
    const order = ["## 1. Beginning", "## 2. Adjunct", "## 3. Body", "Phase 1", "Phase 2", "Phase 3", "## 4. Anything else", "## 5. End"];
    const positions = order.map((h) => r.prompt.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(r.prompt).not.toContain("SHOULD NOT APPEAR");
  });

  it("always injects the locked guardrails", () => {
    const r = compilePrompt(template, { values: { company_name: "Spag Finance" } });
    expect(r.guardrailsInjected).toEqual(["calling_hours", "opt_out", "ai_disclosure", "data_safety"]);
    expect(r.prompt).toContain("Guardrails (always on)");
    expect(r.prompt).toContain("You are an AI voice assistant speaking on behalf of Spag Finance");
  });

  it("keeps the user's wording for a guardrail, refills an empty one, and ignores attempts to disable it", () => {
    const custom: PromptTemplate = {
      ...template,
      blocks: [
        ...template.blocks,
        { id: "g1", section: "anything_else", part: "guardrail", guardrail: "opt_out", title: "Opt-out", content: "If they say stop, opt them out." },
        { id: "g2", section: "anything_else", part: "guardrail", guardrail: "calling_hours", title: "Hours", content: "  " },
        { id: "g3", section: "anything_else", part: "guardrail", guardrail: "ai_disclosure", title: "AI", content: "I am an AI assistant.", enabled: false },
      ],
    };
    const r = compilePrompt(custom, { values: { company_name: "X" } });
    expect(r.prompt).toContain("If they say stop, opt them out.");
    expect(r.prompt).not.toContain(DEFAULT_GUARDRAILS.opt_out.content);
    expect(r.prompt).toContain(DEFAULT_GUARDRAILS.calling_hours.content);
    expect(r.prompt).toContain("I am an AI assistant.");
    expect(r.guardrailsInjected).toEqual(["calling_hours", "data_safety"]);
  });

  it("uses defaults and reports missing required agent variables", () => {
    const r = compilePrompt(template);
    expect(r.prompt).toContain("You are Zara for {{company_name}}");
    expect(r.variables.missingRequired).toEqual(["company_name"]);
    expect(r.errors[0]).toMatch(/company_name/);
  });

  it("leaves call-time placeholders in preview without errors", () => {
    const r = compilePrompt(template, { values: { company_name: "Spag" } });
    expect(r.errors).toEqual([]);
    expect(r.variables.unresolved).toEqual(expect.arrayContaining(["lead_name", "greeting", "address", "goodbye"]));
  });

  it("requires everything to be filled in call mode", () => {
    const r = compilePrompt(template, { values: { company_name: "Spag" }, mode: "call" });
    expect(r.errors.join(" ")).toMatch(/greeting/);

    const now = fromLagosParts(2026, 10, 13, 10, 0);
    const values = { company_name: "Spag", ...buildCallValues({ firstName: "Chinedu", lastName: "Okafor", gender: "male" }, now) };
    const ok = compilePrompt(template, { values, mode: "call" });
    expect(ok.errors).toEqual([]);
    expect(ok.firstMessage).toBe("Good morning, Mr Okafor. My name is Zara from Spag. Is this a good time?");
    expect(ok.prompt).toContain("Have a great day.");
  });

  it("reports undeclared and unused variables", () => {
    const r = compilePrompt({
      ...template,
      variables: [...template.variables, { name: "never_used", label: "x", scope: "agent", required: false }],
      blocks: [...template.blocks, { id: "x", section: "adjunct", title: "x", content: "Mention {{mystery}}." }],
    }, { values: { company_name: "S" } });
    expect(r.variables.undeclared).toEqual(["mystery"]);
    expect(r.variables.unused).toEqual(["never_used"]);
    expect(r.errors.join(" ")).toMatch(/Unknown variables: mystery/);
  });

  it("estimates length", () => {
    const r = compilePrompt(template, { values: { company_name: "Spag" } });
    expect(r.estimatedTokens).toBe(Math.ceil(r.characters / 4));
    expect(r.words).toBeGreaterThan(50);
  });

  it("flags an empty first message", () => {
    expect(compilePrompt({ ...template, firstMessage: "" }, { values: { company_name: "S" } }).errors).toContain("First message is empty.");
  });
});
