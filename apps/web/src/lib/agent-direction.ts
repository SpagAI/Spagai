/**
 * Outbound agents call people; inbound agents answer calls. Each kind gets its own business details,
 * per-call values, first message and starting prompt. Pure, so it can be tested.
 */
import type { AgentConfig, VariableDef } from "@spagai/core";

export type Direction = "outbound" | "inbound";

export const DIRECTION_LABEL: Record<Direction, string> = {
  outbound: "Outbound agent (it calls people)",
  inbound: "Inbound agent (it answers calls)",
};

/** Business details and per-call values that belong to one kind of agent only. */
export const DIRECTION_FIELDS: Record<Direction, VariableDef[]> = {
  outbound: [
    { name: "offer", label: "What you are offering", scope: "agent", required: true, example: "a business account that pays you instantly" },
    { name: "call_reason", label: "Why you are calling them", scope: "agent", required: true, example: "you filled our website form last week" },
    { name: "callback_number", label: "Number they can call back on", scope: "agent", required: false, example: "0800 123 4567" },
    { name: "lead_source", label: "Where the lead came from", scope: "call", required: false, example: "website form" },
  ],
  inbound: [
    { name: "business_description", label: "What your business does", scope: "agent", required: true, example: "We sell and let flats in Lekki and Ajah." },
    { name: "opening_hours", label: "Opening hours", scope: "agent", required: true, example: "Monday to Friday, 8am to 6pm; Saturday 10am to 2pm" },
    { name: "business_address", label: "Address / location", scope: "agent", required: true, example: "12 Admiralty Way, Lekki Phase 1, Lagos" },
    { name: "transfer_number", label: "Number to transfer to when a person must take over", scope: "agent", required: false, example: "0803 123 4567" },
    { name: "caller_number", label: "Caller's phone number (from the incoming call)", scope: "call", required: false, example: "0803 555 0101", allowEmpty: true },
  ],
};

const OTHER: Record<Direction, Direction> = { outbound: "inbound", inbound: "outbound" };

/** The two values every agent has. */
export function baseFields(name: string): VariableDef[] {
  return [
    { name: "company_name", label: "Your company name", scope: "agent", required: true, example: "Spag Finance" },
    { name: "agent_name", label: "Agent's name", scope: "agent", required: true, defaultValue: name },
  ];
}

/** Fields for an agent of this kind. `required: false` keeps them optional (custom agents with their own prompt). */
export function fieldsFor(direction: Direction, name: string, required = true): VariableDef[] {
  return [...baseFields(name), ...DIRECTION_FIELDS[direction].map((v) => (required ? v : { ...v, required: false }))];
}

export function defaultFirstMessage(direction: Direction): string {
  return direction === "outbound"
    ? "Hello, this is {{agent_name}}, an AI assistant calling from {{company_name}}. Is this a good time to talk?"
    : "Hello, thank you for calling {{company_name}}. My name is {{agent_name}}, an AI assistant. How can I help you today?";
}

/** A starting prompt written for this kind of agent. `purpose` is what the person said it should do. */
export function starterPrompt(direction: Direction, purpose: string): string {
  const what = purpose.trim();
  if (direction === "outbound") {
    return [
      "### Who you are",
      "You are {{agent_name}}, a friendly AI voice assistant calling on behalf of {{company_name}}. You speak clear, simple Nigerian English and keep each reply short.",
      "",
      "### Starting the call",
      "Greet the person as {{address}}. Confirm you are speaking to the right person before you share any details. Then say why you are calling: {{call_reason}}. Ask if it is a good time to talk.",
      "",
      "### What you do",
      what || "Explain {{offer}} simply, answer their questions and find out if they are interested. If they are, agree the next step, such as a meeting or a call with the team.",
      "",
      "### If they are busy",
      "Offer to call back at a better time between 8am and 9pm, confirm the day and time, and end the call politely.",
      "",
      "### Before you go",
      "Sum up what was agreed, thank them for their time and say goodbye.",
    ].join("\n");
  }
  return [
    "### Who you are",
    "You are {{agent_name}}, a friendly AI voice assistant answering calls for {{company_name}}. You speak clear, simple Nigerian English and keep each reply short.",
    "",
    "### About the business",
    "{{business_description}}",
    "Opening hours: {{opening_hours}}.",
    "Address: {{business_address}}.",
    "",
    "### Helping the caller",
    "Greet the caller warmly and ask how you can help. Ask for their name early and use it. Answer using the details above and your knowledge base. Never guess: if you do not know, say a colleague will call them back.",
    ...(what ? ["", what] : []),
    "",
    "### Outside opening hours",
    "If they call outside the opening hours, say so politely and offer to take a message so the team can call them back.",
    "",
    "### Before you go",
    "If they want a call back or a booking, take their name and phone number and read the number back to check it. Confirm what happens next, thank them for calling and say goodbye.",
  ].join("\n");
}

/** Business details the person typed for this kind of agent (only known fields, trimmed). */
export function directionValues(direction: Direction, input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of DIRECTION_FIELDS[direction]) {
    const value = input[v.name];
    if (v.scope === "agent" && typeof value === "string" && value.trim()) out[v.name] = value.trim().slice(0, 500);
  }
  return out;
}

const usedIn = (config: AgentConfig, name: string) =>
  [config.firstMessage, ...config.blocks.map((b) => b.content)].some((t) => t.includes(`{{${name}}}`) || new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`).test(t));

/**
 * Change an agent from outbound to inbound (or back). Adds the new kind's fields, removes the old kind's
 * fields that the prompt does not use, and swaps the first message only if it was still the default.
 * The prompt itself is never changed. Safety rules follow when the agent is checked and saved.
 */
export function switchDirection(config: AgentConfig, to: Direction): AgentConfig {
  const from = OTHER[to];
  const oldNames = new Set(DIRECTION_FIELDS[from].map((v) => v.name));
  const kept = config.variables.filter((v) => !oldNames.has(v.name) || usedIn(config, v.name));
  const added = DIRECTION_FIELDS[to].filter((v) => !kept.some((k) => k.name === v.name)).map((v) => ({ ...v, required: false }));
  const values = Object.fromEntries(Object.entries(config.variableValues).filter(([k]) => kept.some((v) => v.name === k) || !oldNames.has(k)));
  return {
    ...config,
    direction: to,
    variables: [...kept, ...added],
    variableValues: values,
    firstMessage: config.firstMessage.trim() === defaultFirstMessage(from) ? defaultFirstMessage(to) : config.firstMessage,
  };
}
