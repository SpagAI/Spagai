import { describe, expect, it } from "vitest";
import { getPreset, normaliseAgentConfig, presetToAgentConfig, VOICE_CATALOGUE, getVoice } from "../src";

const base = () => presetToAgentConfig(getPreset("clinic-booking")!);

describe("presetToAgentConfig", () => {
  it("starts from the preset with guardrails and default silence", () => {
    const c = base();
    expect(c.name).toBe("Halima");
    expect(c.blocks.filter((b) => b.guardrail)).toHaveLength(4);
    expect(c.silence.checkInAfterSeconds).toBe(7);
    expect(c.silence.endCallAfterSeconds).toBe(15);
    expect(c.variableValues).toEqual({ agent_name: "Halima" });
  });
});

describe("normaliseAgentConfig", () => {
  it("accepts a valid config", () => {
    expect(normaliseAgentConfig(base()).ok).toBe(true);
  });

  it("puts back guardrails a user removed, and re-enables disabled ones", () => {
    const c = base();
    c.blocks = c.blocks.filter((b) => b.guardrail !== "opt_out").map((b) => (b.guardrail ? { ...b, enabled: false } : b));
    const r = normaliseAgentConfig(c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const guards = r.config.blocks.filter((b) => b.guardrail);
    expect(guards.map((b) => b.guardrail).sort()).toEqual(["ai_disclosure", "calling_hours", "data_safety", "opt_out"]);
    expect(guards.every((b) => b.enabled !== false)).toBe(true);
  });

  it("always includes end_call", () => {
    const r = normaliseAgentConfig({ ...base(), tools: ["save_lead_data"] });
    expect(r.ok && r.config.tools).toEqual(["save_lead_data", "end_call"]);
  });

  it("rejects silence settings where the call ends before the check-in", () => {
    const r = normaliseAgentConfig({ ...base(), silence: { ...base().silence, endCallAfterSeconds: 5 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/silence.endCallAfterSeconds/);
  });

  it("rejects unknown tools, empty names and duplicate block ids", () => {
    expect(normaliseAgentConfig({ ...base(), tools: ["launch_rocket"] }).ok).toBe(false);
    expect(normaliseAgentConfig({ ...base(), name: "  " }).ok).toBe(false);
    const c = base();
    c.blocks.push({ ...c.blocks[0]! });
    const r = normaliseAgentConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/duplicate block id/);
  });
});

describe("voice catalogue", () => {
  it("covers all five launch languages with mock voices", () => {
    for (const lang of ["en-NG", "pcm", "yo", "ha", "ig"]) {
      expect(VOICE_CATALOGUE.some((v) => v.language === lang && v.provider === "mock")).toBe(true);
    }
    expect(getVoice("mock-en-ng-male-1")?.name).toBe("Tunde");
  });
});

import { agentReadiness } from "../src";

describe("agentReadiness", () => {
  it("lists what is missing before an agent can go live", () => {
    const r = agentReadiness(base());
    expect(r.ready).toBe(false);
    expect(r.problems.join(" ")).toMatch(/company_name/);
    expect(r.problems).toContain("Choose a voice.");
  });

  it("is ready once business details and a voice are set", () => {
    const c = base();
    c.variableValues = { agent_name: "Halima", company_name: "Ikeja Clinic", clinic_address: "12 Allen Avenue", emergency_line: "112" };
    c.voiceId = "mock-en-ng-female-1";
    expect(agentReadiness(c)).toEqual({ ready: true, problems: [] });
  });
});
