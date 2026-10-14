/**
 * Simulator logic (M3): the free "mock" agent brain and silence handling.
 *
 * The mock brain does NOT read the prompt. It recognises a few common caller
 * replies (stop calling, are you a robot, wrong number, busy, yes, no, a day and
 * time, an email address) and answers with safe, rule-following lines. It exists
 * so the whole call flow can be tested for free. A real language model is
 * switched on with LLM_PROVIDER (see .env.example).
 */

import type { SilenceSettings, ToolId } from "../agent";
import { emailToSpeech, normaliseSpokenEmail } from "../email";
import { fromLagosParts, toLagosParts, validateAppointment } from "../time";

export type SimRole = "agent" | "caller";

export interface SimMessage {
  role: SimRole;
  text: string;
}

export interface SimToolCall {
  tool: ToolId;
  args: Record<string, string | boolean>;
}

export interface SimTurn {
  text: string;
  toolCalls: SimToolCall[];
  /** True when the agent hangs up after this line. */
  endsCall: boolean;
}

export type SimIntent =
  | "opt_out"
  | "ai_question"
  | "wrong_number"
  | "busy"
  | "goodbye"
  | "email"
  | "appointment"
  | "negative"
  | "positive"
  | "unclear";

const INTENT_PATTERNS: [Exclude<SimIntent, "email" | "appointment" | "unclear">, RegExp][] = [
  ["opt_out", /\b(stop calling|don'?t call|do not call|never call|remove (me|my number)|take me off|unsubscribe|opt ?out)\b/i],
  ["ai_question", /\b(robot|machine|bot|ai|artificial|real person|human|recording)\b/i],
  ["wrong_number", /\b(wrong number|not (me|him|her)|no one (by|called) that|you have the wrong)\b/i],
  ["busy", /\b(busy|driving|in a meeting|call (me )?(back|later)|not a good time|bad time)\b/i],
  ["goodbye", /\b(bye|goodbye|that'?s all|nothing else|i have to go)\b/i],
  ["negative", /^\s*(no|nope|not really|not interested|i'?m not interested|no thanks?)\b/i],
  ["positive", /\b(yes|yeah|yep|sure|okay|ok|alright|of course|interested|go ahead|please do|i would like)\b/i],
];

const DAY_WORDS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Work out what the caller meant. Order matters: opting out always wins. */
export function detectIntent(text: string): SimIntent {
  const t = text.trim();
  if (INTENT_PATTERNS[0]![1].test(t)) return "opt_out";
  if (/@|\bat\b.*\bdot\b/i.test(t) || /\bemail\b.*\b(is|it'?s)\b/i.test(t)) return "email";
  if (parseDay(t) || parseTime(t)) return "appointment";
  for (const [intent, re] of INTENT_PATTERNS.slice(1)) if (re.test(t)) return intent;
  return "unclear";
}

/** "tomorrow", "Thursday", "today" → a date in Lagos time, or null. */
export function parseDay(text: string, now: Date = new Date()): string | null {
  const t = text.toLowerCase();
  const p = toLagosParts(now);
  let offset: number | null = null;
  if (/\btoday\b/.test(t)) offset = 0;
  else if (/\btomorrow\b/.test(t)) offset = 1;
  else {
    const idx = DAY_WORDS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
    if (idx >= 0) offset = ((idx - p.weekday + 7) % 7) || 7;
  }
  if (offset === null) return null;
  const d = toLagosParts(fromLagosParts(p.year, p.month, p.day + offset, 12));
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** "10am", "2:30 pm", "14:00", "by 3" → "HH:MM", or null. */
export function parseTime(text: string): string | null {
  const m = /\b(?:at |by |around )?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|in the morning|in the afternoon|in the evening)?\b/i.exec(text);
  if (!m) return null;
  const hasMarker = Boolean(m[3]) || Boolean(m[2]) || /\b(at|by|around) \d/i.test(m[0]);
  if (!hasMarker) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const marker = (m[3] ?? "").toLowerCase();
  if (/p|afternoon|evening/.test(marker) && hour < 12) hour += 12;
  if (/^a/.test(marker) && hour === 12) hour = 0;
  // A bare "at 3" during office hours means 3 in the afternoon.
  if (!marker && hour >= 1 && hour <= 6) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "14:30" → "2 30 in the afternoon" (the speech sanitiser turns digits into words). */
export function timeToSpeech(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const part = h < 12 ? "in the morning" : h < 17 ? "in the afternoon" : "in the evening";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ` ${String(m).padStart(2, "0")}` : ""} ${part}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-15" → "Thursday 15 October". */
export function dateToSpeech(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number) as [number, number, number];
  const p = toLagosParts(fromLagosParts(y, mo, d, 12));
  const day = DAY_WORDS[p.weekday]!;
  return `${day[0]!.toUpperCase()}${day.slice(1)} ${d} ${MONTHS[mo - 1]}`;
}

export interface MockReplyInput {
  /** What the caller just said. */
  callerText: string;
  /** Earlier turns, oldest first (not including callerText). */
  history: SimMessage[];
  /** Call values: suffix, goodbye, company_name, ... */
  values: Record<string, string | undefined>;
  /** Tools this agent may use. */
  tools: ToolId[];
  /** The simulated "now" (Lagos time is derived from it). */
  now: Date;
}

/** ", Sir" / ", Ma" / "" placed at the end of a sentence that has no name in it. */
function sfx(values: MockReplyInput["values"]): string {
  return values.suffix ? `, ${values.suffix}` : "";
}

/** The free mock agent. Deterministic, so tests and demos are repeatable. */
export function mockAgentReply(input: MockReplyInput): SimTurn {
  const { callerText, history, values, tools, now } = input;
  const s = sfx(values);
  const company = values.company_name?.trim() || "our company";
  const goodbye = values.goodbye ?? "Have a great day.";
  const has = (t: ToolId) => tools.includes(t);
  const save = (args: SimToolCall["args"]): SimToolCall[] => (has("save_lead_data") ? [{ tool: "save_lead_data", args }] : []);
  const end = (reason: string): SimToolCall => ({ tool: "end_call", args: { reason } });

  switch (detectIntent(callerText)) {
    case "opt_out":
      return {
        text: `I understand${s}. I will make sure you are not called again. Thank you for your time. ${goodbye}`,
        toolCalls: [...save({ outcome: "opted_out", opt_out: true }), end("Caller asked not to be called again.")],
        endsCall: true,
      };
    case "ai_question":
      return {
        text: `Yes${s}. I am an AI assistant calling on behalf of ${company}. Would you like me to continue?`,
        toolCalls: [],
        endsCall: false,
      };
    case "wrong_number":
      return {
        text: `I am sorry for the trouble${s}. I will update our records. ${goodbye}`,
        toolCalls: [...save({ outcome: "wrong_number" }), end("Wrong number.")],
        endsCall: true,
      };
    case "busy":
      return {
        text: `No problem${s}. What day and time would be better for us to call you back?`,
        toolCalls: [],
        endsCall: false,
      };
    case "goodbye": {
      // Do not overwrite an outcome already saved on this call (e.g. a booking).
      const alreadySaved = history.some((m) => m.role === "agent" && /^Thank you.*\. (You are booked|I have noted)/.test(m.text));
      return {
        text: `Thank you for your time${s}. ${goodbye}`,
        toolCalls: [...(alreadySaved ? [] : save({ outcome: "other", notes: "Caller ended the conversation." })), end("Caller said goodbye.")],
        endsCall: true,
      };
    }
    case "negative":
      return {
        text: `I understand${s}. Thank you for listening. ${goodbye}`,
        toolCalls: [...save({ outcome: "not_interested", interest_level: "none" }), end("Not interested.")],
        endsCall: true,
      };
    case "email":
      return replyToEmail(callerText, values, has("save_lead_data"));
    case "appointment":
      return replyToAppointment(input);
    case "positive":
      if (has("book_appointment")) {
        return { text: `Wonderful${s}. What day works best for a short meeting?`, toolCalls: [], endsCall: false };
      }
      return {
        text: `That is good to hear${s}. Is there anything else you would like to know?`,
        toolCalls: save({ outcome: "other", interest_level: "high" }),
        endsCall: false,
      };
    default: {
      const lastAgent = [...history].reverse().find((m) => m.role === "agent");
      const repeated = lastAgent?.text.startsWith("I am sorry, I did not quite catch that");
      return {
        text: repeated
          ? `Thank you for sharing that${s}. Is there anything else I can help you with today?`
          : `I am sorry, I did not quite catch that${s}. Could you say that again?`,
        toolCalls: [],
        endsCall: false,
      };
    }
  }
}

function replyToEmail(callerText: string, values: MockReplyInput["values"], canSave: boolean): SimTurn {
  const s = sfx(values);
  const spoken = /(?:email(?: address)? is|it'?s|it is)\s+(.+)$/i.exec(callerText)?.[1] ?? callerText;
  const result = normaliseSpokenEmail(spoken);
  if (!result.valid) {
    return { text: `I am sorry${s}. Could you spell the email address for me slowly?`, toolCalls: [], endsCall: false };
  }
  return {
    text: `Thank you${s}. I have noted your email as ${emailToSpeech(result.email)}. Is there anything else I can help you with?`,
    toolCalls: canSave ? [{ tool: "save_lead_data", args: { outcome: "other", email: result.email } }] : [],
    endsCall: false,
  };
}

function replyToAppointment(input: MockReplyInput): SimTurn {
  const { callerText, history, values, tools, now } = input;
  const s = sfx(values);
  const callerLines = [...history.filter((m) => m.role === "caller").map((m) => m.text), callerText];
  // Use the newest day and time mentioned, so "Thursday" then "10am" works across two turns.
  const date = [...callerLines].reverse().map((t) => parseDay(t, now)).find(Boolean) ?? null;
  const time = parseTime(callerText) ?? [...callerLines].reverse().map(parseTime).find(Boolean) ?? null;
  const asksCallback = history.some((m) => m.role === "agent" && /call you back/i.test(m.text));
  const booking = tools.includes("book_appointment") && !asksCallback;

  if (!date) return { text: `Thank you${s}. Which day would suit you?`, toolCalls: [], endsCall: false };
  if (!time) return { text: `Thank you${s}. What time on ${dateToSpeech(date)} would suit you?`, toolCalls: [], endsCall: false };

  if (!booking) {
    const saveCallback: SimToolCall[] = tools.includes("save_lead_data")
      ? [{ tool: "save_lead_data", args: { outcome: "callback", callback_date: date, callback_time: time } }]
      : [];
    return {
      text: `Thank you${s}. We will call you back on ${dateToSpeech(date)} at ${timeToSpeech(time)}. ${values.goodbye ?? ""}`.trim(),
      toolCalls: [...saveCallback, { tool: "end_call", args: { reason: "Callback agreed." } }],
      endsCall: true,
    };
  }

  const check = validateAppointment(date, time, { now });
  if (!check.valid) {
    return {
      text: `I am sorry${s}. That time is not available. We take bookings on weekdays between 9 in the morning and 6 in the evening. What other time would work for you?`,
      toolCalls: [],
      endsCall: false,
    };
  }
  return {
    text: `Thank you${s}. You are booked for ${dateToSpeech(date)} at ${timeToSpeech(time)}. Is there anything else I can help you with?`,
    toolCalls: [
      { tool: "book_appointment", args: { appointment_date: date, appointment_time: time } },
      ...(tools.includes("save_lead_data") ? [{ tool: "save_lead_data" as const, args: { outcome: "booked", interest_level: "high" } }] : []),
    ],
    endsCall: false,
  };
}

/**
 * What the agent does when the caller is silent.
 * `checkInsSoFar` counts earlier check-ins in this silence.
 */
export function silenceTurn(silence: SilenceSettings, checkInsSoFar: number): SimTurn & { afterSeconds: number } {
  if (checkInsSoFar < silence.maxCheckIns) {
    return { text: silence.checkInMessage, toolCalls: [], endsCall: false, afterSeconds: silence.checkInAfterSeconds };
  }
  return {
    text: silence.closingMessage,
    toolCalls: [{ tool: "end_call", args: { reason: "The caller was silent." } }],
    endsCall: true,
    afterSeconds: silence.endCallAfterSeconds,
  };
}

export * from "./mock-call";
