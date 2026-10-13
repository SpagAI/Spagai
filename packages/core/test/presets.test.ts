import { describe, expect, it } from "vitest";
import { compilePrompt, lintPrompt, PRESETS, presetToTemplate, TOOL_DEFINITIONS, getPreset } from "../src";

describe("presets", () => {
  it("has the eight starter presets", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "fintech-outbound-zara",
      "fintech-support",
      "repayment-reminders",
      "kyc-follow-up",
      "telecom-churn-complaint",
      "real-estate-lead-qualifier",
      "clinic-booking",
      "delivery-confirmation",
    ]);
    expect(getPreset("clinic-booking")?.agentName).toBe("Halima");
  });

  it("marks the Zara preset as a placeholder until the real prompt is added", () => {
    expect(getPreset("fintech-outbound-zara")?.status).toBe("placeholder");
  });

  describe.each(PRESETS.map((p) => [p.id, p] as const))("%s", (_id, preset) => {
    const values = Object.fromEntries(preset.variables.map((v) => [v.name, v.example ?? v.defaultValue ?? "X"]));
    const compiled = compilePrompt(presetToTemplate(preset), { values });
    const lint = lintPrompt({ prompt: compiled.prompt, firstMessage: compiled.firstMessage });

    it("compiles without errors once agent values are filled in", () => {
      expect(compiled.errors).toEqual([]);
      expect(compiled.variables.undeclared).toEqual([]);
    });

    it("lints clean (no errors or warnings)", () => {
      expect(lint.issues.filter((i) => i.severity !== "info")).toEqual([]);
    });

    it("covers all three body phases and the end of the call", () => {
      const parts = preset.blocks.map((b) => b.part);
      expect(parts).toEqual(expect.arrayContaining(["understand", "solution", "reassure", "goodbye", "end_call"]));
    });

    it("only uses known tools and always includes end_call and save_lead_data", () => {
      for (const t of preset.tools) expect(TOOL_DEFINITIONS[t]).toBeDefined();
      expect(preset.tools).toEqual(expect.arrayContaining(["end_call", "save_lead_data"]));
    });

    it("stays under the latency warning length", () => {
      expect(compiled.estimatedTokens).toBeLessThan(1500);
    });
  });
});
