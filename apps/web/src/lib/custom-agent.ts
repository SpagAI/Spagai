/**
 * "Custom" agents: the person writes everything themselves (prompt, first message, voice,
 * voice settings). Pure, so it can be tested. The locked safety rules are added later by
 * normaliseAgentConfig, as for every agent.
 */
import { DEFAULT_SILENCE, findVariables, MAX_BLOCK_CHARS, SYSTEM_VARIABLES, voiceSettingsSchema } from "@spagai/core";
import { z } from "zod";

export const customAgentSchema = z.object({
  name: z.string().trim().min(1, "Give your agent a name.").max(80),
  company: z.string().trim().min(1, "Add your business name.").max(120),
  direction: z.enum(["inbound", "outbound"]),
  language: z.enum(["en-NG", "pcm", "yo", "ha", "ig"]),
  voiceId: z.string().max(100).nullable(),
  firstMessage: z.string().trim().min(1, "Write what the agent says first.").max(1000),
  prompt: z.string().trim().min(20, "Write the agent's instructions (at least a sentence or two).").max(MAX_BLOCK_CHARS, `Instructions can be up to ${MAX_BLOCK_CHARS.toLocaleString("en-NG")} characters.`),
  voiceSettings: voiceSettingsSchema,
});

export type CustomAgentInput = z.infer<typeof customAgentSchema>;

/** Variables every call fills in by itself (from the lead and the clock), plus the agent's own two. */
const BUILT_IN = new Set([...SYSTEM_VARIABLES.map((v) => v.name), "agent_name", "company_name"]);

const label = (name: string) => name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The saved config for a custom agent, exactly as the person wrote it. */
export function customAgentDraft(input: CustomAgentInput) {
  // Any other {{name}} they used becomes a per-call value (e.g. from a lead list column).
  const extra = [...new Set([...findVariables(input.firstMessage), ...findVariables(input.prompt)])].filter((n) => !BUILT_IN.has(n));
  return {
    name: input.name,
    language: input.language,
    voiceId: input.voiceId,
    addressMode: "B" as const,
    firstMessage: input.firstMessage,
    blocks: [{ id: "custom_instructions", section: "beginning" as const, part: "main" as const, title: "Your instructions", content: input.prompt }],
    variables: [
      { name: "company_name", label: "Your company name", scope: "agent" as const, required: true, example: input.company },
      { name: "agent_name", label: "Agent's name", scope: "agent" as const, required: true, defaultValue: input.name },
      ...extra.slice(0, 40).map((name) => ({ name, label: label(name), scope: "call" as const, required: false })),
    ],
    variableValues: { company_name: input.company, agent_name: input.name },
    tools: ["end_call" as const],
    silence: DEFAULT_SILENCE,
    voiceSettings: input.voiceSettings,
  };
}

/** A sensible first message to start from, which the person can rewrite. */
export function defaultFirstMessage(direction: "inbound" | "outbound"): string {
  return direction === "outbound"
    ? "Hello, this is {{agent_name}}, an AI assistant calling from {{company_name}}. Is this a good time to talk?"
    : "Hello, thank you for calling {{company_name}}. My name is {{agent_name}}, an AI assistant. How can I help you today?";
}
