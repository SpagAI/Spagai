/**
 * The compliance gate (M4). Every call attempt asks this one function first.
 * It never throws: it returns every reason a call is blocked, so the reasons can
 * be logged and shown. DRAFT rules: see docs/COMPLIANCE_TODO.md (needs legal review).
 */

import { parseNigerianPhone } from "../phone";
import { checkWindow, DEFAULT_CALLING_WINDOW, parseHHMM, type TimeWindow, type Weekday } from "../time";

export type BlockCode =
  | "agent_not_ready"
  | "invalid_phone"
  | "opted_out"
  | "do_not_call"
  | "no_consent"
  | "no_lead_source"
  | "outside_calling_hours"
  | "max_attempts"
  | "too_soon";

export interface Block {
  code: BlockCode;
  message: string;
  /** Permanent blocks stop this lead for the campaign. Temporary ones can be retried later. */
  permanent: boolean;
}

export interface CallAttemptInput {
  now: Date;
  agentReady: boolean;
  lead: {
    phone: string;
    optedOut: boolean;
    consent: boolean;
    source: string | null | undefined;
  };
  /** Phone numbers (E.164) on the organisation's do-not-call list. */
  doNotCall: ReadonlySet<string>;
  /** The campaign's own window. It can only narrow the legal default, never widen it. */
  campaignWindow?: TimeWindow;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  /** Minimum minutes between attempts to the same person. */
  retryAfterMinutes: number;
}

export interface GateResult {
  allowed: boolean;
  blocks: Block[];
}

/** The overlap of the campaign's window and the legal default. */
export function effectiveCallingWindow(campaign?: TimeWindow): TimeWindow {
  if (!campaign) return DEFAULT_CALLING_WINDOW;
  const start = Math.max(parseHHMM(campaign.start), parseHHMM(DEFAULT_CALLING_WINDOW.start));
  const end = Math.min(parseHHMM(campaign.end), parseHHMM(DEFAULT_CALLING_WINDOW.end));
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const days = campaign.days.filter((d): d is Weekday => DEFAULT_CALLING_WINDOW.days.includes(d));
  return { start: hhmm(start), end: hhmm(Math.max(start, end)), days };
}

export function checkCallAttempt(input: CallAttemptInput): GateResult {
  const blocks: Block[] = [];
  const add = (code: BlockCode, message: string, permanent: boolean) => blocks.push({ code, message, permanent });

  if (!input.agentReady) add("agent_not_ready", "The agent is not marked as ready.", false);

  const phone = parseNigerianPhone(input.lead.phone);
  if (!phone.valid) add("invalid_phone", phone.reason ?? "Invalid phone number.", true);

  if (input.lead.optedOut) add("opted_out", "This person asked not to be called.", true);
  if (phone.valid && input.doNotCall.has(phone.e164!)) add("do_not_call", "This number is on the do-not-call list.", true);
  if (!input.lead.consent) add("no_consent", "There is no consent record for this person.", true);
  if (!input.lead.source?.trim()) add("no_lead_source", "The lead source is missing.", true);

  const window = checkWindow(input.now, effectiveCallingWindow(input.campaignWindow));
  if (!window.allowed) add("outside_calling_hours", `Outside calling hours. ${window.reason}`, false);

  if (input.attempts >= input.maxAttempts) {
    add("max_attempts", `Already called ${input.attempts} times (the limit is ${input.maxAttempts}).`, true);
  } else if (input.lastAttemptAt) {
    const waited = (input.now.getTime() - input.lastAttemptAt.getTime()) / 60_000;
    if (waited < input.retryAfterMinutes) {
      add("too_soon", `Last attempt was ${Math.max(0, Math.floor(waited))} minutes ago. Wait at least ${input.retryAfterMinutes} minutes.`, false);
    }
  }

  return { allowed: blocks.length === 0, blocks };
}
