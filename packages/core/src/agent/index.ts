/**
 * Agent definitions: the tools an agent can call, silence handling, and the
 * shape of a preset (a ready-made agent stored as a JSON data file).
 */

import { z } from "zod";
import { compilePrompt, withGuardrails } from "../prompt/compiler";
import { lintPrompt } from "../prompt/linter";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type ToolId =
  | "check_calendar"
  | "book_appointment"
  | "reschedule_appointment"
  | "save_lead_data"
  | "end_call";

export interface ToolParameter {
  type: "string" | "boolean" | "number";
  description: string;
  pattern?: string;
  enum?: string[];
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required: string[];
}

const DATE_PARAM: ToolParameter = {
  type: "string",
  description: "Appointment date as YYYY-MM-DD (West Africa Time).",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
const TIME_PARAM: ToolParameter = {
  type: "string",
  description: "Appointment time as HH:MM, 24-hour, West Africa Time.",
  pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
};

export const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  check_calendar: {
    id: "check_calendar",
    name: "Check calendar",
    description: "Check which appointment slots are free on a date. Use before offering times.",
    parameters: { appointment_date: DATE_PARAM },
    required: ["appointment_date"],
  },
  book_appointment: {
    id: "book_appointment",
    name: "Book appointment",
    description: "Book an appointment once the person has agreed a date and time.",
    parameters: {
      appointment_date: DATE_PARAM,
      appointment_time: TIME_PARAM,
      notes: { type: "string", description: "Short note about what the meeting is for." },
    },
    required: ["appointment_date", "appointment_time"],
  },
  reschedule_appointment: {
    id: "reschedule_appointment",
    name: "Reschedule appointment",
    description: "Move an existing appointment to a new date and time.",
    parameters: {
      appointment_date: DATE_PARAM,
      appointment_time: TIME_PARAM,
      reason: { type: "string", description: "Why it is being moved." },
    },
    required: ["appointment_date", "appointment_time"],
  },
  save_lead_data: {
    id: "save_lead_data",
    name: "Save lead data",
    description: "Save what was learned on the call. Never save card numbers, PINs, OTPs or BVN.",
    parameters: {
      interest_level: { type: "string", description: "How interested the person is.", enum: ["high", "medium", "low", "none"] },
      outcome: {
        type: "string",
        description: "Call outcome.",
        enum: ["booked", "callback", "not_interested", "wrong_number", "opted_out", "no_answer", "other"],
      },
      email: { type: "string", description: "Email address, written with symbols (e.g. ada.obi@gmail.com)." },
      notes: { type: "string", description: "Short summary." },
      opt_out: { type: "boolean", description: "True if the person asked not to be called again." },
      callback_date: { ...DATE_PARAM, description: "Callback date, YYYY-MM-DD (WAT)." },
      callback_time: { ...TIME_PARAM, description: "Callback time, HH:MM (WAT)." },
    },
    required: ["outcome"],
  },
  end_call: {
    id: "end_call",
    name: "End call",
    description: "End the call after saying goodbye.",
    parameters: { reason: { type: "string", description: "Why the call is ending." } },
    required: [],
  },
};

// ---------------------------------------------------------------------------
// Silence handling
// ---------------------------------------------------------------------------

export interface SilenceSettings {
  /** Seconds of silence before the agent checks in. */
  checkInAfterSeconds: number;
  /** What the agent says to check in. */
  checkInMessage: string;
  /** How many times to check in before giving up. */
  maxCheckIns: number;
  /** Seconds of total silence before the call ends. */
  endCallAfterSeconds: number;
  /** What the agent says before ending a silent call. */
  closingMessage: string;
}

export const DEFAULT_SILENCE: SilenceSettings = {
  checkInAfterSeconds: 7,
  checkInMessage: "Hello, are you still there?",
  maxCheckIns: 1,
  endCallAfterSeconds: 15,
  closingMessage: "It seems we have lost the line. I will end the call now. Thank you, and goodbye.",
};

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const sectionSchema = z.enum(["beginning", "adjunct", "body", "anything_else", "end"]);
const partSchema = z.enum([
  "main", "understand", "solution", "reassure",
  "booking", "routing", "tools", "guardrail", "other",
  "before_you_go", "goodbye", "end_call",
]);

export const promptBlockSchema = z.object({
  id: z.string().min(1),
  section: sectionSchema,
  part: partSchema.optional(),
  title: z.string().min(1),
  content: z.string(),
  guardrail: z.enum(["calling_hours", "opt_out", "ai_disclosure", "data_safety"]).optional(),
  enabled: z.boolean().optional(),
});

export const variableDefSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  label: z.string().min(1),
  scope: z.enum(["agent", "call", "system"]),
  required: z.boolean(),
  defaultValue: z.string().optional(),
  example: z.string().optional(),
  description: z.string().optional(),
});

export const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  sector: z.enum(["fintech", "telecom", "real_estate", "health", "logistics", "general"]),
  direction: z.enum(["outbound", "inbound"]),
  description: z.string().min(1),
  /** "draft" presets need the founder's real prompt or review before use. */
  status: z.enum(["ready", "draft", "placeholder"]),
  language: z.string().default("en-NG"),
  agentName: z.string().min(1),
  addressMode: z.enum(["A", "B"]).default("A"),
  rulePack: z.string().min(1),
  firstMessage: z.string().min(1),
  tools: z.array(z.enum(["check_calendar", "book_appointment", "reschedule_appointment", "save_lead_data", "end_call"])),
  silence: z
    .object({
      checkInAfterSeconds: z.number().positive(),
      checkInMessage: z.string().min(1),
      maxCheckIns: z.number().int().min(0),
      endCallAfterSeconds: z.number().positive(),
      closingMessage: z.string().min(1),
    })
    .optional(),
  variables: z.array(variableDefSchema),
  blocks: z.array(promptBlockSchema).min(1),
});

export type AgentPreset = z.infer<typeof presetSchema>;

// ---------------------------------------------------------------------------
// Saved agent configuration (what the Agent Builder edits and saves)
// ---------------------------------------------------------------------------

export const silenceSchema = z
  .object({
    checkInAfterSeconds: z.number().int().min(3).max(60),
    checkInMessage: z.string().trim().min(1).max(300),
    maxCheckIns: z.number().int().min(0).max(3),
    endCallAfterSeconds: z.number().int().min(5).max(120),
    closingMessage: z.string().trim().min(1).max(300),
  })
  .refine((s) => s.endCallAfterSeconds > s.checkInAfterSeconds, {
    message: "The call must end later than the check-in.",
    path: ["endCallAfterSeconds"],
  });

export const agentConfigSchema = z.object({
  name: z.string().trim().min(1).max(80),
  language: z.string().min(2).max(10),
  voiceId: z.string().max(100).nullable(),
  addressMode: z.enum(["A", "B"]),
  firstMessage: z.string().trim().min(1).max(1000),
  blocks: z.array(promptBlockSchema.extend({ content: z.string().max(8000) })).min(1).max(60),
  variables: z.array(variableDefSchema).max(50),
  /** Values for agent-scope variables (company_name, product_name, ...). */
  variableValues: z.record(z.string(), z.string().max(500)),
  tools: z.array(z.enum(["check_calendar", "book_appointment", "reschedule_appointment", "save_lead_data", "end_call"])),
  silence: silenceSchema,
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

/** Tools every agent must have. */
export const REQUIRED_TOOLS: ToolId[] = ["end_call"];

/**
 * Server-side safety net before saving: validates, re-adds any locked guardrail
 * that was removed, forces guardrails on, and makes sure required tools are present.
 * Returns the cleaned config, or the validation errors.
 */
export function normaliseAgentConfig(
  input: unknown,
): { ok: true; config: AgentConfig } | { ok: false; errors: string[] } {
  const parsed = agentConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`),
    };
  }
  const config = parsed.data;
  const { blocks } = withGuardrails(config.blocks);
  const ids = new Set<string>();
  for (const b of blocks) {
    if (ids.has(b.id)) return { ok: false, errors: [`blocks: duplicate block id "${b.id}"`] };
    ids.add(b.id);
  }
  const tools = [...new Set([...config.tools, ...REQUIRED_TOOLS])];
  return { ok: true, config: { ...config, blocks, tools } };
}

/** Turn a preset into a starting config for a new agent. */
export function presetToAgentConfig(preset: AgentPreset): AgentConfig {
  const variableValues: Record<string, string> = {};
  for (const v of preset.variables) if (v.scope === "agent" && v.defaultValue) variableValues[v.name] = v.defaultValue;
  return {
    name: preset.agentName,
    language: preset.language,
    voiceId: null,
    addressMode: preset.addressMode,
    firstMessage: preset.firstMessage,
    blocks: withGuardrails(preset.blocks).blocks,
    variables: preset.variables,
    variableValues,
    tools: preset.tools,
    silence: preset.silence ?? DEFAULT_SILENCE,
  };
}

/**
 * Can this agent be marked "ready"? It must compile with no errors (all required
 * business details filled in) and have no lint errors. Warnings are allowed.
 */
export function agentReadiness(config: AgentConfig): { ready: boolean; problems: string[] } {
  const compiled = compilePrompt(
    { blocks: config.blocks, variables: config.variables, firstMessage: config.firstMessage },
    { values: config.variableValues, mode: "preview" },
  );
  const lint = lintPrompt({ prompt: compiled.prompt, firstMessage: compiled.firstMessage });
  const problems = [...compiled.errors, ...lint.issues.filter((i) => i.severity === "error").map((i) => i.message)];
  if (!config.voiceId) problems.push("Choose a voice.");
  return { ready: problems.length === 0, problems };
}
