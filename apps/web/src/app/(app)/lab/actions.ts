"use server";

import {
  buildCallValues,
  compilePrompt,
  fromLagosParts,
  isValidEmail,
  isWithinCallingWindow,
  lintSpokenLine,
  sanitiseForSpeech,
  silenceTurn,
  validateAppointment,
  normaliseAgentConfig,
  type AgentConfig,
  type LintIssue,
  type SimToolCall,
  type SimTurn,
} from "@spagai/core";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { audit, loadAgent } from "@/server/agents";
import { functionSpec, resultForAi, runCustomTool, toolsForAgent } from "@/server/custom-tools";
import { getLlm, PHONE_CALL_RULES, todayLine } from "@/server/providers";
import { RateLimiter } from "@/server/rate-limit";
import { SpeechToTextError, transcribe } from "@/server/speech-to-text";

const turnSchema = z.object({
  lead: z.object({
    title: z.string().max(20),
    gender: z.enum(["male", "female", "unknown"]),
    firstName: z.string().max(60),
    lastName: z.string().max(60),
  }),
  /** Per-call variables (amount_due, product, ...). */
  callValues: z.record(z.string(), z.string().max(500)),
  /** Simulated time, "YYYY-MM-DDTHH:MM" in Lagos time. */
  when: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  history: z.array(z.object({ role: z.enum(["agent", "caller"]), text: z.string().max(2000) })).max(80),
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("start") }),
    z.object({ type: z.literal("message"), text: z.string().trim().min(1).max(1000) }),
    z.object({ type: z.literal("silence"), checkInsSoFar: z.number().int().min(0).max(10) }),
  ]),
});

const inputSchema = turnSchema.extend({ agentId: z.string().min(1).max(100) });
export type SimulateInput = z.infer<typeof inputSchema>;
/** "Talk to agent" in the builder: the same turn, with the settings currently on screen (not yet saved). */
export type TalkInput = z.infer<typeof turnSchema> & {
  config: unknown;
  agentId?: string;
  /** Call the workspace's real webhooks for its own tools (otherwise they are simulated). */
  realTools?: boolean;
};

interface TurnOptions {
  agent?: { id: string; name: string };
  realTools: boolean;
}

/** Real AI replies cost money: at most 40 turns a minute per workspace. */
const turnsPerMinute = new RateLimiter(40, 60_000);

export interface CheckedToolCall extends SimToolCall {
  ok: boolean;
  /** What the simulated tool answered, or why it failed. */
  result: string;
}

export interface AgentLine {
  /** What the agent wrote. */
  text: string;
  /** What the voice actually says, after cleaning. */
  spoken: string;
  issues: LintIssue[];
  toolCalls: CheckedToolCall[];
  endsCall: boolean;
  /** For silence turns: seconds of quiet before this line. */
  afterSeconds?: number;
}

export type SimulateResult =
  | {
      ok: true;
      line: AgentLine;
      provider: string;
      /** Only on "start". */
      callingWindow?: { allowed: boolean; reason: string | null };
      /** Only on "start": the full prompt the language model receives. */
      prompt?: string;
    }
  | { ok: false; errors: string[] };

function parseWhen(when: string): Date {
  const [d, t] = when.split("T") as [string, string];
  const [y, mo, day] = d.split("-").map(Number) as [number, number, number];
  const [h, mi] = t.split(":").map(Number) as [number, number];
  return fromLagosParts(y, mo, day, h, mi);
}

/** Run the agent's tool calls against simulated tools, with the same checks a real call would use. */
function checkTools(calls: SimToolCall[], now: Date): CheckedToolCall[] {
  return calls.map((call) => {
    const a = call.args;
    switch (call.tool) {
      case "book_appointment":
      case "reschedule_appointment": {
        const check = validateAppointment(String(a.appointment_date ?? ""), String(a.appointment_time ?? ""), { now });
        return { ...call, ok: check.valid, result: check.valid ? "Booked (simulated)." : check.errors.join(" ") };
      }
      case "check_calendar":
        return { ...call, ok: true, result: "Free slots (simulated): 10:00, 12:00, 15:00." };
      case "save_lead_data": {
        if (typeof a.email === "string" && a.email && !isValidEmail(a.email)) {
          return { ...call, ok: false, result: `"${a.email}" is not a valid email address, so it was not saved.` };
        }
        if (!a.outcome) return { ...call, ok: false, result: "outcome is required." };
        return { ...call, ok: true, result: "Saved (simulated)." };
      }
      case "end_call":
        return { ...call, ok: true, result: "Call ended." };
      default:
        return { ...call, ok: false, result: "Unknown tool." };
    }
  });
}

function toLine(turn: SimTurn, now: Date, afterSeconds?: number, ran: CheckedToolCall[] = []): AgentLine {
  const left = [...ran];
  return {
    text: turn.text,
    spoken: sanitiseForSpeech(turn.text),
    issues: lintSpokenLine(turn.text),
    // Use what each tool actually answered during the turn; check any others now.
    toolCalls: turn.toolCalls.map((call) => {
      const i = left.findIndex((r) => r.tool === call.tool);
      return i >= 0 ? left.splice(i, 1)[0]! : checkTools([call], now)[0]!;
    }),
    endsCall: turn.endsCall,
    ...(afterSeconds !== undefined && { afterSeconds }),
  };
}

/** One step of a simulated call: the opening line, a reply to the caller, or a reaction to silence. */
export async function simulate(raw: SimulateInput): Promise<SimulateResult> {
  const ctx = await requirePermission("agent:view");
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const input = parsed.data;

  const agent = await loadAgent(ctx.organisation.id, input.agentId);
  if (!agent) return { ok: false, errors: ["Agent not found."] };
  // Remember that this agent has been tried in the Lab (shown in its setup steps).
  if (input.history.length === 0) await audit(ctx.organisation.id, ctx.user.id, "agent.tested", { type: "agent", id: agent.id });
  return runTurn(ctx.organisation.id, agent.config, input, { agent: { id: agent.id, name: agent.config.name }, realTools: false });
}

/** "Talk to agent": one turn with the builder's current (possibly unsaved) settings. Nothing is saved. */
export async function talkToAgent(raw: TalkInput): Promise<SimulateResult> {
  const ctx = await requirePermission("agent:view");
  const parsed = turnSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  // Same checks as saving: valid settings, locked safety rules put back.
  const normalised = normaliseAgentConfig(raw.config);
  if (!normalised.ok) return { ok: false, errors: normalised.errors };
  const agentId = typeof raw.agentId === "string" ? raw.agentId.slice(0, 100) : undefined;
  return runTurn(ctx.organisation.id, normalised.config, parsed.data, {
    agent: agentId ? { id: agentId, name: normalised.config.name } : undefined,
    realTools: raw.realTools !== false,
  });
}

async function runTurn(organisationId: string, config: AgentConfig, input: z.infer<typeof turnSchema>, opts: TurnOptions): Promise<SimulateResult> {
  if (input.event.type === "message" && !turnsPerMinute.check(organisationId).allowed) {
    return { ok: false, errors: ["Too many messages. Please wait a minute."] };
  }
  const now = parseWhen(input.when);
  const lead = { ...input.lead, gender: input.lead.gender === "unknown" ? "" : input.lead.gender };
  const values: Record<string, string> = {
    ...input.callValues,
    ...buildCallValues({ ...lead, ...input.callValues }, now, config.addressMode),
    ...config.variableValues,
  };

  // Call mode: every required value must be present, exactly as when dialling.
  const compiled = compilePrompt(
    { blocks: config.blocks, variables: config.variables, firstMessage: config.firstMessage, direction: config.direction },
    { values, mode: "call" },
  );
  if (compiled.errors.length) return { ok: false, errors: compiled.errors };

  const llm = getLlm();
  const { event } = input;

  if (event.type === "start") {
    const window = isWithinCallingWindow(now);
    return {
      ok: true,
      provider: llm.name,
      line: toLine({ text: compiled.firstMessage, toolCalls: [], endsCall: false }, now),
      // Calling hours only limit agents that call people; inbound agents answer whenever someone calls.
      callingWindow: config.direction === "inbound" ? { allowed: true, reason: null } : { allowed: window.allowed, reason: window.reason },
      // Exactly what a real model receives (the phone call rules are added for real models only).
      prompt: llm.name === "mock" ? compiled.prompt : `${compiled.prompt}\n\n${PHONE_CALL_RULES}\n- ${todayLine(now)}`,
    };
  }

  if (event.type === "silence") {
    const turn = silenceTurn(config.silence, event.checkInsSoFar);
    return { ok: true, provider: llm.name, line: toLine(turn, now, turn.afterSeconds) };
  }

  try {
    const custom = await toolsForAgent(organisationId, config.customTools);
    const ran: CheckedToolCall[] = [];
    const leadName = [input.lead.firstName, input.lead.lastName].filter(Boolean).join(" ");
    const turn = await llm.reply({
      systemPrompt: compiled.prompt,
      history: [...input.history, { role: "caller", text: event.text }],
      values,
      tools: config.tools,
      customTools: custom.map(functionSpec),
      now,
      // A real model hears back what each tool did, then speaks.
      runTool: async (call) => {
        const tool = custom.find((t) => t.name === call.tool);
        if (tool) {
          if (!opts.realTools) {
            ran.push({ ...call, ok: true, result: "Sent (simulated; real webhooks are off)." });
            return "Success (simulated).";
          }
          const r = await runCustomTool(tool, call.args, { agent: opts.agent, callId: `talk_${Date.now()}`, callerPhone: input.callValues.caller_number || input.callValues.phone, leadName, now: new Date() }, "talk");
          ran.push({ ...call, ok: r.ok, result: `${r.status ? `${r.status}: ` : ""}${r.response.slice(0, 300)}` });
          return resultForAi(r);
        }
        const [checked] = checkTools([call], now);
        if (checked) ran.push(checked);
        return checked ? `${checked.ok ? "Success" : "Failed"}: ${checked.result}` : "Unknown tool.";
      },
    });
    return { ok: true, provider: llm.name, line: toLine(turn, now, undefined, ran) };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "The agent could not reply."] };
  }
}

export type TranscribeResult = { ok: true; text: string } | { ok: false; message: string };

/** "Test your agent": turn a short recording into text on the server (sharp on any browser). */
export async function transcribeSpeech(form: FormData): Promise<TranscribeResult> {
  const ctx = await requirePermission("agent:view");
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return { ok: false, message: "Nothing was recorded." };
  if (audio.size > 1_900_000) return { ok: false, message: "That recording is too long. Please speak in shorter turns." };
  const hints = z.array(z.string().max(80)).max(30).safeParse(JSON.parse(String(form.get("hints") ?? "[]")));
  const language = z.string().max(10).safeParse(form.get("language"));
  try {
    const text = await transcribe(ctx.organisation.id, audio, hints.success ? hints.data : [], language.success ? language.data : "en-NG");
    return { ok: true, text };
  } catch (e) {
    return { ok: false, message: e instanceof SpeechToTextError ? e.message : "The recording could not be understood. Please try again." };
  }
}
