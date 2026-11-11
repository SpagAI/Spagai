import { DEFAULT_VOICE_SETTINGS, normaliseAgentConfig } from "@spagai/core";
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
});
