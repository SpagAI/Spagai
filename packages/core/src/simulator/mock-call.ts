/**
 * Mock telephony (M4): a whole pretend call between an agent and a pretend
 * customer, so campaigns can run end to end for free. Each lead is given a
 * "persona" (interested, busy, opts out, ...) chosen from a seed, so the same
 * lead behaves the same way every time.
 */

import type { SilenceSettings, ToolId } from "../agent";
import { toLagosParts } from "../time";
import { mockAgentReply, silenceTurn, type SimMessage, type SimToolCall } from "./index";

export type Persona = "interested" | "callback" | "not_interested" | "curious" | "opt_out" | "wrong_number" | "no_answer" | "silent";

export type CallOutcome = "booked" | "callback" | "not_interested" | "wrong_number" | "opted_out" | "no_answer" | "other";

const WEIGHTS: [Persona, number][] = [
  ["interested", 25],
  ["callback", 15],
  ["not_interested", 15],
  ["curious", 10],
  ["opt_out", 10],
  ["wrong_number", 5],
  ["no_answer", 15],
  ["silent", 5],
];

/** Same seed, same persona. */
export function pickPersona(seed: string): Persona {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const total = WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = (h >>> 0) % total;
  for (const [persona, w] of WEIGHTS) {
    if (r < w) return persona;
    r -= w;
  }
  return "interested";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The next weekday after today, by name (Saturday → "Monday"). */
function nextWorkingDayName(now: Date): string {
  const today = toLagosParts(now).weekday;
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7;
    if (d >= 1 && d <= 5) return DAYS[d]!;
  }
  return "Monday";
}

function script(persona: Persona, now: Date): string[] {
  switch (persona) {
    case "interested":
      return ["Yes, go ahead", `${nextWorkingDayName(now)} at 10am`, "No, that's all. Bye"];
    case "callback":
      return ["I'm busy, call me later", "tomorrow at 4pm"];
    case "not_interested":
      return ["No, I'm not interested"];
    case "curious":
      return ["Am I talking to a robot?", "Okay, go ahead", "No, that's all. Bye"];
    case "opt_out":
      return ["Please stop calling me"];
    case "wrong_number":
      return ["You have the wrong number"];
    case "no_answer":
    case "silent":
      return [];
  }
}

export interface MockCallInput {
  persona: Persona;
  /** The agent's opening line, already filled in. */
  firstMessage: string;
  values: Record<string, string | undefined>;
  tools: ToolId[];
  silence: SilenceSettings;
  now: Date;
}

export interface MockCallResult {
  answered: boolean;
  transcript: SimMessage[];
  toolCalls: SimToolCall[];
  outcome: CallOutcome;
  durationSeconds: number;
  optedOut: boolean;
  /** Set when a callback was agreed (YYYY-MM-DD and HH:MM, WAT). */
  callback: { date: string; time: string } | null;
}

const MAX_TURNS = 8;

export function runMockCall(input: MockCallInput): MockCallResult {
  const { persona, values, tools, silence, now } = input;
  if (persona === "no_answer") {
    return { answered: false, transcript: [], toolCalls: [], outcome: "no_answer", durationSeconds: 0, optedOut: false, callback: null };
  }

  const transcript: SimMessage[] = [{ role: "agent", text: input.firstMessage }];
  const toolCalls: SimToolCall[] = [];
  let ended = false;
  let seconds = 2;
  const speak = (text: string) => (seconds += Math.ceil(text.split(/\s+/).length / 2.5) + 1);
  speak(input.firstMessage);

  if (persona === "silent") {
    for (let i = 0; i <= silence.maxCheckIns && !ended; i++) {
      const turn = silenceTurn(silence, i);
      seconds += turn.afterSeconds;
      transcript.push({ role: "agent", text: turn.text });
      speak(turn.text);
      toolCalls.push(...turn.toolCalls);
      ended = turn.endsCall;
    }
  } else {
    for (const line of script(persona, now).slice(0, MAX_TURNS)) {
      if (ended) break;
      const history = [...transcript];
      transcript.push({ role: "caller", text: line });
      speak(line);
      const turn = mockAgentReply({ callerText: line, history, values, tools, now });
      transcript.push({ role: "agent", text: turn.text });
      speak(turn.text);
      toolCalls.push(...turn.toolCalls);
      ended = turn.endsCall;
    }
  }

  const saves = toolCalls.filter((c) => c.tool === "save_lead_data");
  const optedOut = saves.some((c) => c.args.opt_out === true) || persona === "opt_out";
  const lastOutcome = saves.at(-1)?.args.outcome;
  const booked = toolCalls.some((c) => c.tool === "book_appointment");
  const cb = saves.find((c) => c.args.outcome === "callback");
  const outcome: CallOutcome = optedOut
    ? "opted_out"
    : booked
      ? "booked"
      : persona === "silent"
        ? "no_answer"
        : ((typeof lastOutcome === "string" ? lastOutcome : "other") as CallOutcome);

  return {
    answered: true,
    transcript,
    toolCalls,
    outcome,
    durationSeconds: seconds,
    optedOut,
    callback: cb ? { date: String(cb.args.callback_date), time: String(cb.args.callback_time) } : null,
  };
}
