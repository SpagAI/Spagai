/**
 * "Custom" agents: the person writes everything themselves (prompt, first message, voice,
 * voice settings). Pure, so it can be tested. The locked safety rules are added later by
 * normaliseAgentConfig, as for every agent.
 */
import { DEFAULT_SILENCE, findVariables, MAX_BLOCK_CHARS, SYSTEM_VARIABLES, voiceSettingsSchema } from "@spagai/core";
import { z } from "zod";
import { DIRECTION_FIELDS, fieldsFor, directionValues, type Direction } from "./agent-direction";

export const customAgentSchema = z.object({
  name: z.string().trim().min(1, "Give your agent a name.").max(80),
  company: z.string().trim().min(1, "Add your business name.").max(120),
  direction: z.enum(["inbound", "outbound"]),
  language: z.enum(["en-NG", "pcm", "yo", "ha", "ig"]),
  voiceId: z.string().max(100).nullable(),
  firstMessage: z.string().trim().min(1, "Write what the agent says first.").max(1000),
  prompt: z.string().trim().min(20, "Write the agent's instructions (at least a sentence or two).").max(MAX_BLOCK_CHARS, `Instructions can be up to ${MAX_BLOCK_CHARS.toLocaleString("en-NG")} characters.`),
  voiceSettings: voiceSettingsSchema,
  /** Business details for this kind of agent (optional for custom agents). */
  details: z.record(z.string(), z.string().max(500)).optional(),
});

export type CustomAgentInput = z.infer<typeof customAgentSchema>;

/** Variables every call fills in by itself (from the lead and the clock), plus the agent's own two and this kind's fields. */
const builtIn = (direction: Direction) => new Set([...SYSTEM_VARIABLES.map((v) => v.name), "agent_name", "company_name", ...DIRECTION_FIELDS[direction].map((v) => v.name)]);

const label = (name: string) => name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The saved config for a custom agent, exactly as the person wrote it. */
export function customAgentDraft(input: CustomAgentInput) {
  // Any other {{name}} they used becomes a per-call value (e.g. from a lead list column).
  const known = builtIn(input.direction);
  const extra = [...new Set([...findVariables(input.firstMessage), ...findVariables(input.prompt)])].filter((n) => !known.has(n));
  return {
    name: input.name,
    direction: input.direction,
    language: input.language,
    voiceId: input.voiceId,
    addressMode: "B" as const,
    firstMessage: input.firstMessage,
    blocks: [{ id: "custom_instructions", section: "beginning" as const, part: "main" as const, title: "Your instructions", content: input.prompt }],
    // This kind's business details are offered but optional: the prompt is the person's own.
    variables: [
      ...fieldsFor(input.direction, input.name, false).map((v) => (v.name === "company_name" || v.name === "agent_name" ? { ...v, required: true } : v)),
      ...extra.slice(0, 40).map((name) => ({ name, label: label(name), scope: "call" as const, required: false })),
    ],
    variableValues: { company_name: input.company, agent_name: input.name, ...directionValues(input.direction, input.details ?? {}) },
    tools: ["end_call" as const],
    silence: DEFAULT_SILENCE,
    voiceSettings: input.voiceSettings,
  };
}

/** A sensible first message to start from, which the person can rewrite. */
export { defaultFirstMessage } from "./agent-direction";
