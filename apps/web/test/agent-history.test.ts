import { DEFAULT_SILENCE, DEFAULT_VOICE_SETTINGS, agentDraftSchema, type AgentConfig } from "@spagai/core";
import { describe, expect, it } from "vitest";
import { promptLength, record, redo, startHistory, STEP_MS, undo, wasCleared } from "@/lib/agent-history";

const config = (prompt: string): AgentConfig => ({
  name: "Kemi", language: "en-NG", voiceId: null, addressMode: "B", firstMessage: "Hello",
  blocks: [{ id: "custom_instructions", section: "beginning", part: "main", title: "Your instructions", content: prompt }],
  variables: [], variableValues: {}, tools: ["end_call"], silence: DEFAULT_SILENCE, voiceSettings: DEFAULT_VOICE_SETTINGS,
});

describe("undo and redo", () => {
  it("steps back and forward through changes", () => {
    const a = config("one"), b = config("two"), c = config("three");
    let h = record(record(startHistory(a), b, 10_000), c, 20_000);
    h = undo(h);
    expect(h.present).toBe(b);
    h = undo(h);
    expect(h.present).toBe(a);
    expect(undo(h).present).toBe(a);
    h = redo(h);
    expect(h.present).toBe(b);
  });

  it("joins quick typing into one step, but a forced change is its own step", () => {
    const a = config("a"), b = config("ab"), c = config("abc"), d = config("");
    let h = record(startHistory(a), b, 10_000);
    h = record(h, c, 10_000 + STEP_MS / 2);
    expect(undo(h).present).toBe(a);
    h = record(h, d, 10_000 + STEP_MS / 2 + 10, true);
    expect(undo(h).present).toBe(c);
  });

  it("a new change after undo clears redo", () => {
    let h = record(startHistory(config("a")), config("b"), 10_000);
    h = undo(h);
    h = record(h, config("c"), 30_000);
    expect(h.future).toEqual([]);
  });
});

describe("spotting a cleared prompt", () => {
  const long = "Answer questions politely and briefly. ".repeat(10);
  it("notices when most of a real prompt disappears", () => {
    expect(promptLength(config(long))).toBeGreaterThan(200);
    expect(wasCleared(config(long), config(""))).toBe(true);
    expect(wasCleared(config(long), config(long.slice(0, 300)))).toBe(false);
    expect(wasCleared(config("short"), config(""))).toBe(false);
  });
});

describe("drafts", () => {
  it("accept half-finished work that a full save would refuse", () => {
    expect(agentDraftSchema.safeParse({ ...config(""), name: "", firstMessage: "" }).success).toBe(true);
  });
});
