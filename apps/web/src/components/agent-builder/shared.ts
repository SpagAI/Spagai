import { buildCallValues, fromLagosParts, type AgentConfig, type BlockPart, type SectionId } from "@spagai/core";

/** Fixed sample time so server and browser render the same preview: Tuesday 13 Oct 2026, 10:30 WAT. */
export const SAMPLE_NOW = fromLagosParts(2026, 10, 13, 10, 30);

/** The pretend person the agent talks to while testing (real calls use each lead's own details). */
export interface TestLead {
  title: string;
  gender: "male" | "female" | "unknown";
  firstName: string;
  lastName: string;
  /** Inbound agents: the number the test caller is calling from. */
  phone?: string;
}

export const SAMPLE_LEAD: TestLead = { title: "", gender: "male", firstName: "Chinedu", lastName: "Okafor" };

/** Values for previews and tests, filled in for the test person. */
export function sampleValues(config: AgentConfig, lead: TestLead = SAMPLE_LEAD): Record<string, string> {
  const callExamples: Record<string, string> = {};
  for (const v of config.variables) if (v.scope === "call" && v.example) callExamples[v.name] = v.example;
  const person = { ...lead, gender: lead.gender === "unknown" ? "" : lead.gender };
  return {
    ...callExamples,
    ...(lead.phone ? { caller_number: lead.phone } : {}),
    ...buildCallValues({ ...person, ...callExamples }, SAMPLE_NOW, config.addressMode),
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
