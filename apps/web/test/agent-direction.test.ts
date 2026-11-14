import { agentReadiness, compilePrompt, normaliseAgentConfig } from "@spagai/core";
import { describe, expect, it } from "vitest";
import { DIRECTION_FIELDS, defaultFirstMessage, fieldsFor, starterPrompt, switchDirection } from "@/lib/agent-direction";
import { customAgentDraft } from "@/lib/custom-agent";

const outbound = {
  name: "Kemi", company: "Lagos Homes", direction: "outbound" as const, language: "en-NG" as const, voiceId: null,
  firstMessage: defaultFirstMessage("outbound"), prompt: starterPrompt("outbound", ""),
  voiceSettings: { speed: 1, volume: 0, expressiveness: 0.7, naturalNumbers: true },
  details: { offer: "three-bedroom flats in Lekki", call_reason: "you asked about our flats last week" },
};

describe("inbound and outbound agents", () => {
  it("each kind has its own business details", () => {
    const out = fieldsFor("outbound", "Kemi").map((v) => v.name);
    const inb = fieldsFor("inbound", "Kemi").map((v) => v.name);
    expect(out).toContain("call_reason");
    expect(out).not.toContain("opening_hours");
    expect(inb).toContain("opening_hours");
    expect(inb).toContain("caller_number");
    expect(inb).not.toContain("call_reason");
  });

  it("each kind has its own first message and starting prompt", () => {
    expect(defaultFirstMessage("outbound")).toMatch(/calling from/);
    expect(defaultFirstMessage("inbound")).toMatch(/thank you for calling/i);
    expect(starterPrompt("outbound", "")).toMatch(/right person/);
    expect(starterPrompt("outbound", "")).toMatch(/\{\{call_reason\}\}/);
    expect(starterPrompt("inbound", "")).toMatch(/\{\{opening_hours\}\}/);
    expect(starterPrompt("inbound", "")).not.toMatch(/right person/);
  });

  it("an inbound agent built from its starter compiles with its details and has no calling-hours rule", () => {
    const draft = customAgentDraft({ ...outbound, direction: "inbound", firstMessage: defaultFirstMessage("inbound"), prompt: starterPrompt("inbound", ""), details: { business_description: "We let flats.", opening_hours: "9am to 5pm", business_address: "Lekki" } });
    const r = normaliseAgentConfig(draft);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.direction).toBe("inbound");
    expect(r.config.blocks.some((b) => b.guardrail === "calling_hours")).toBe(false);
    const compiled = compilePrompt({ blocks: r.config.blocks, variables: r.config.variables, firstMessage: r.config.firstMessage, direction: "inbound" }, { values: r.config.variableValues, mode: "preview" });
    expect(compiled.prompt).toContain("Opening hours: 9am to 5pm.");
    expect(agentReadiness(r.config).problems.join(" ")).not.toMatch(/calling-hours/);
  });

  it("switching kind swaps the fields and the default first message, but never the prompt", () => {
    const r = normaliseAgentConfig(customAgentDraft(outbound));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const inbound = switchDirection(r.config, "inbound");
    expect(inbound.direction).toBe("inbound");
    expect(inbound.firstMessage).toBe(defaultFirstMessage("inbound"));
    expect(inbound.variables.map((v) => v.name)).toEqual(expect.arrayContaining(DIRECTION_FIELDS.inbound.map((v) => v.name)));
    // The outbound prompt uses {{call_reason}}, so that field stays; unused outbound ones go.
    expect(inbound.variables.map((v) => v.name)).toContain("call_reason");
    expect(inbound.variables.map((v) => v.name)).not.toContain("callback_number");
    expect(inbound.blocks).toEqual(r.config.blocks);
    const custom = switchDirection({ ...r.config, firstMessage: "My own opening line." }, "inbound");
    expect(custom.firstMessage).toBe("My own opening line.");
  });
});
