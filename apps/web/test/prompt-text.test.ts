import { getPreset, normaliseAgentConfig, PRESETS, presetToAgentConfig } from "@spagai/core";
import { describe, expect, it } from "vitest";
import { promptText, withPromptText } from "@/lib/prompt-text";

const template = presetToAgentConfig(getPreset(PRESETS[0]!.id)!);

describe("one prompt box", () => {
  it("shows a template's whole prompt as one text, without the safety rules", () => {
    const text = promptText(template);
    for (const b of template.blocks.filter((x) => !x.guardrail && x.enabled !== false && x.content.trim())) expect(text).toContain(b.content.trim());
    for (const g of template.blocks.filter((x) => x.guardrail)) expect(text).not.toContain(g.content.trim());
  });

  it("saving the text keeps it word for word and keeps the safety rules", () => {
    const next = withPromptText(template, "My own prompt, written my way.");
    expect(promptText(next)).toBe("My own prompt, written my way.");
    expect(next.blocks.filter((b) => b.guardrail)).toEqual(template.blocks.filter((b) => b.guardrail));
    const saved = normaliseAgentConfig(next);
    expect(saved.ok).toBe(true);
  });

  it("an emptied prompt is just empty (and the safety rules remain)", () => {
    const cleared = withPromptText(template, "");
    expect(promptText(cleared)).toBe("");
    expect(cleared.blocks.some((b) => b.guardrail)).toBe(true);
  });

  it("editing a template's joined text then saving round-trips", () => {
    const text = promptText(template) + "\nAlways be brief.";
    expect(promptText(withPromptText(template, text))).toBe(text);
  });
});
