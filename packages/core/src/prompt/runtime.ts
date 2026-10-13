/**
 * Builds the per-call variable values from a lead and the current time.
 * This is where the address builder and time tools meet the prompt.
 */

import { buildAddress, type AddressMode } from "../address";
import { chooseGoodbye, formatHHMM, getGreeting, getTimeOfDay, toLagosParts } from "../time";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface CallLead {
  title?: string | null;
  gender?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  [extra: string]: string | null | undefined;
}

export function buildSystemValues(now: Date): Record<string, string> {
  const p = toLagosParts(now);
  return {
    greeting: getGreeting(now),
    goodbye: chooseGoodbye(now).text,
    time_of_day: getTimeOfDay(now),
    current_date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    current_time: formatHHMM(p.minutesOfDay),
    current_day: DAY_NAMES[p.weekday]!,
  };
}

export function buildCallValues(lead: CallLead, now: Date, mode: AddressMode = "A"): Record<string, string> {
  const addr = buildAddress({ ...lead, mode });
  const leadValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(lead)) if (typeof v === "string" && v) leadValues[k] = v;
  return {
    ...leadValues,
    lead_name: lead.firstName ?? "",
    last_name: lead.lastName ?? "",
    address: addr.address,
    suffix: addr.suffix,
    ...buildSystemValues(now),
  };
}
