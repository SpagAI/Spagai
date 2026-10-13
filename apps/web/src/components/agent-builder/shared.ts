import { buildCallValues, fromLagosParts, type AgentConfig, type BlockPart, type SectionId } from "@spagai/core";

/** Fixed sample time so server and browser render the same preview: Tuesday 13 Oct 2026, 10:30 WAT. */
export const SAMPLE_NOW = fromLagosParts(2026, 10, 13, 10, 30);

export const SAMPLE_LEAD = { title: "", gender: "male", firstName: "Chinedu", lastName: "Okafor" };

/** Values used when "Fill with a sample lead" is on. */
export function sampleValues(config: AgentConfig): Record<string, string> {
  const callExamples: Record<string, string> = {};
  for (const v of config.variables) if (v.scope === "call" && v.example) callExamples[v.name] = v.example;
  return {
    ...callExamples,
    ...buildCallValues({ ...SAMPLE_LEAD, ...callExamples }, SAMPLE_NOW, config.addressMode),
    ...config.variableValues,
  };
}

export const PARTS_FOR_SECTION: Record<SectionId, BlockPart[]> = {
  beginning: ["main"],
  adjunct: ["main"],
  body: ["understand", "solution", "reassure"],
  anything_else: ["booking", "routing", "tools", "other"],
  end: ["before_you_go", "goodbye", "end_call"],
};

export function newBlockId(): string {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
