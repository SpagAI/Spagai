import "server-only";
import { DEFAULT_SILENCE, getPreset, presetToAgentConfig } from "@spagai/core";

/** The starting config for an agent built from scratch: a name, what it does and its business. */
export function blankAgentDraft(input: { name: string; direction: "inbound" | "outbound"; purpose: string; company: string; language?: string; voiceId?: string | null }) {
  return {
    name: input.name,
    language: input.language ?? "en-NG",
    voiceId: input.voiceId ?? null,
    addressMode: "B",
    firstMessage: input.direction === "outbound"
      ? "Hello, this is {{agent_name}}, an AI assistant calling from {{company_name}}. Is this a good time to talk?"
      : "Hello, thank you for calling {{company_name}}. My name is {{agent_name}}, an AI assistant. How can I help you today?",
    blocks: [
      { id: "identity", section: "beginning", part: "main", title: "Who you are", content: "You are {{agent_name}}, a friendly AI voice assistant for {{company_name}}. You speak clear, simple Nigerian English and keep your answers short." },
      { id: "purpose", section: "body", part: "solution", title: "What you do", content: input.purpose || "Describe what this agent should do on each call: the questions it answers, the information it collects and when to book a meeting." },
      { id: "goodbye", section: "end", part: "goodbye", title: "Before you go", content: "Before ending, check if there is anything else you can help with, thank the person and say goodbye." },
    ],
    variables: [
      { name: "company_name", label: "Your company name", scope: "agent", required: true, example: "Spag Finance" },
      { name: "agent_name", label: "Agent's name", scope: "agent", required: true, defaultValue: input.name },
    ],
    variableValues: { company_name: input.company, agent_name: input.name },
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
