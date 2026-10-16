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
  type LintIssue,
  type SimToolCall,
  type SimTurn,
} from "@spagai/core";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { audit, loadAgent } from "@/server/agents";
import { getLlm } from "@/server/providers";

const inputSchema = z.object({
  agentId: z.string().min(1).max(100),
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

export type SimulateInput = z.infer<typeof inputSchema>;

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
    }
  });
}

function toLine(turn: SimTurn, now: Date, afterSeconds?: number): AgentLine {
  return {
    text: turn.text,
    spoken: sanitiseForSpeech(turn.text),
    issues: lintSpokenLine(turn.text),
    toolCalls: checkTools(turn.toolCalls, now),
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
  const { config } = agent;
  // Remember that this agent has been tried in the Lab (shown in its setup steps).
  if (input.history.length === 0) await audit(ctx.organisation.id, ctx.user.id, "agent.tested", { type: "agent", id: agent.id });

  const now = parseWhen(input.when);
  const lead = { ...input.lead, gender: input.lead.gender === "unknown" ? "" : input.lead.gender };
  const values: Record<string, string> = {
    ...input.callValues,
    ...buildCallValues({ ...lead, ...input.callValues }, now, config.addressMode),
    ...config.variableValues,
  };

  // Call mode: every required value must be present, exactly as when dialling.
  const compiled = compilePrompt(
    { blocks: config.blocks, variables: config.variables, firstMessage: config.firstMessage },
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
      callingWindow: { allowed: window.allowed, reason: window.reason },
      prompt: compiled.prompt,
    };
  }

  if (event.type === "silence") {
    const turn = silenceTurn(config.silence, event.checkInsSoFar);
    return { ok: true, provider: llm.name, line: toLine(turn, now, turn.afterSeconds) };
  }

  try {
    const turn = await llm.reply({
      systemPrompt: compiled.prompt,
      history: [...input.history, { role: "caller", text: event.text }],
      values,
      tools: config.tools,
      now,
    });
    return { ok: true, provider: llm.name, line: toLine(turn, now) };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "The agent could not reply."] };
  }
}
