import "server-only";
import { DEFAULT_SILENCE, getPreset, presetToAgentConfig } from "@spagai/core";
import { defaultFirstMessage, directionValues, fieldsFor, starterPrompt, type Direction } from "@/lib/agent-direction";
import { PROMPT_BLOCK_ID } from "@/lib/prompt-text";

/**
 * The starting config for an agent built from scratch (Quick start). Outbound and inbound agents
 * get their own business details, first message and starting prompt.
 */
export function blankAgentDraft(input: {
  name: string;
  direction: Direction;
  purpose: string;
  company: string;
  language?: string;
  voiceId?: string | null;
  /** Business details for this kind of agent (offer, call_reason… or business_description, opening_hours…). */
  details?: Record<string, unknown>;
}) {
  return {
    name: input.name,
    direction: input.direction,
    language: input.language ?? "en-NG",
    voiceId: input.voiceId ?? null,
    addressMode: "B",
    firstMessage: defaultFirstMessage(input.direction),
    blocks: [{ id: PROMPT_BLOCK_ID, section: "beginning", part: "main", title: "Your instructions", content: starterPrompt(input.direction, input.purpose) }],
    variables: fieldsFor(input.direction, input.name),
    variableValues: { company_name: input.company, agent_name: input.name, ...directionValues(input.direction, input.details ?? {}) },
    tools: ["end_call"],
    silence: DEFAULT_SILENCE,
  };
}

/** A template-based agent with Zara's choices (name, business, voice, language) filled in. */
export function presetAgentDraft(presetId: string, input: { name: string; company: string; voiceId: string; language: string }) {
  const preset = getPreset(presetId);
  if (!preset) return null;
  const config = presetToAgentConfig(preset);
  return {
    ...config,
    name: input.name,
    voiceId: input.voiceId,
    language: input.language,
    variableValues: { ...config.variableValues, company_name: input.company, agent_name: input.name },
  };
}
