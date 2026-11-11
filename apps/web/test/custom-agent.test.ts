import { agentReadiness, DEFAULT_VOICE_SETTINGS, normaliseAgentConfig } from "@spagai/core";
import { describe, expect, it } from "vitest";
import { customAgentDraft, customAgentSchema, defaultFirstMessage } from "@/lib/custom-agent";

const input = {
  name: "Kemi",
  company: "Lagos Homes",
  direction: "outbound" as const,
  language: "en-NG" as const,
  voiceId: "fish_audio:68c4d2918d094396847014eadba619bb",
  firstMessage: "Hi {{lead_name}}, this is {{agent_name}} from {{company_name}}.",
  prompt: "You help people book viewings of {{property_name}}. Keep answers short and confirm {{viewing_date}} before ending.",
  voiceSettings: { speed: 1.2, volume: 3, expressiveness: 0.4, naturalNumbers: false },
};

describe("custom agents", () => {
  it("keeps the person's own prompt, first message, voice and voice settings", () => {
    const result = normaliseAgentConfig(customAgentDraft(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.config;
    expect(c.firstMessage).toBe(input.firstMessage);
    expect(c.voiceId).toBe(input.voiceId);
    expect(c.voiceSettings).toEqual(input.voiceSettings);
    expect(c.blocks.find((b) => b.id === "custom_instructions")?.content).toBe(input.prompt);
    expect(c.variableValues).toMatchObject({ company_name: "Lagos Homes", agent_name: "Kemi" });
  });

  it("still adds the locked safety rules", () => {
    const result = normaliseAgentConfig(customAgentDraft(input));
    expect(result.ok && result.config.blocks.some((b) => b.guardrail)).toBe(true);
  });

  it("turns the person's own {{placeholders}} into per-call values, but not built-in ones", () => {
    const names = customAgentDraft(input).variables.map((v) => v.name);
    expect(names).toEqual(["company_name", "agent_name", "property_name", "viewing_date"]);
  });

  it("checks the form", () => {
    expect(customAgentSchema.safeParse(input).success).toBe(true);
    expect(customAgentSchema.safeParse({ ...input, prompt: "short" }).success).toBe(false);
    expect(customAgentSchema.safeParse({ ...input, voiceSettings: { ...DEFAULT_VOICE_SETTINGS, speed: 3 } }).success).toBe(false);
    expect(defaultFirstMessage("inbound")).toMatch(/thank you for calling/);
  });

  it("accepts a very long prompt (50,000 characters) and still lets the agent go live", () => {
    const long = "Answer questions about our products politely and briefly. ".repeat(900).slice(0, 50_000);
    expect(long).toHaveLength(50_000);
    expect(customAgentSchema.safeParse({ ...input, prompt: long }).success).toBe(true);
    expect(customAgentSchema.safeParse({ ...input, prompt: long + "x" }).success).toBe(false);
    const result = normaliseAgentConfig(customAgentDraft({ ...input, prompt: long }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ready = agentReadiness({ ...result.config, variableValues: { ...result.config.variableValues } });
    expect(ready.problems.join(" ")).not.toMatch(/tokens/);
  });
});

describe("customer details from the lead", () => {
  it("are known to every agent, so {{lead_name}}, {{last_name}}, {{title}} and {{gender}} are not 'unknown'", async () => {
    const { compilePrompt } = await import("@spagai/core");
    const draft = customAgentDraft({ ...input, firstMessage: "Hello {{title}} {{lead_name}} {{last_name}}", prompt: "The customer is {{gender}}. Be polite and brief with them always." });
    const compiled = compilePrompt({ blocks: draft.blocks, variables: draft.variables, firstMessage: draft.firstMessage }, { values: { company_name: "X", agent_name: "Kemi", lead_name: "Chinedu", last_name: "", title: "", gender: "male" }, mode: "call" });
    expect(compiled.errors).toEqual([]);
  });
});
