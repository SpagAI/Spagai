/**
 * Time tools. Everything is decided in Africa/Lagos time (WAT, UTC+1, no daylight saving).
 *
 * - Calling window:      08:00 to 21:00 (a call may START at 20:59, not at 21:00).
 * - Team booking window: 09:00 to 18:00, Monday to Friday by default.
 * - Time of day:         morning 05:00-11:59, afternoon 12:00-16:59, evening otherwise.
 * - Goodbye chooser:     weekend / evening / day.
 */

export const LAGOS_TZ = "Africa/Lagos";
/** WAT is a fixed UTC+1 offset. Nigeria does not use daylight saving time. */
const LAGOS_OFFSET_MINUTES = 60;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface LagosParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
  /** Minutes since local midnight. */
  minutesOfDay: number;
}

/** Break a moment in time into Lagos wall-clock parts. */
export function toLagosParts(date: Date): LagosParts {
  const shifted = new Date(date.getTime() + LAGOS_OFFSET_MINUTES * 60_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour,
    minute,
    weekday: shifted.getUTCDay() as Weekday,
    minutesOfDay: hour * 60 + minute,
  };
}

/** Build a Date from Lagos wall-clock values. */
export function fromLagosParts(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - LAGOS_OFFSET_MINUTES * 60_000);
}

/** "HH:MM" -> minutes since midnight. Throws on bad input. */
export function parseHHMM(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) throw new Error(`Expected time as HH:MM (24-hour), got "${value}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatHHMM(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string; // "HH:MM" (exclusive)
  /** Allowed weekdays, 0 = Sunday. */
  days: Weekday[];
}

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];

export const DEFAULT_CALLING_WINDOW: TimeWindow = { start: "08:00", end: "21:00", days: ALL_DAYS };
export const DEFAULT_BOOKING_WINDOW: TimeWindow = { start: "09:00", end: "18:00", days: WEEKDAYS };

export interface WindowCheck {
  allowed: boolean;
  /** Plain-English reason when not allowed. */
  reason: string | null;
  /** The next moment the window opens (only when not allowed). */
  nextOpenAt: Date | null;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function checkWindow(date: Date, window: TimeWindow): WindowCheck {
  const start = parseHHMM(window.start);
  const end = parseHHMM(window.end);
  const p = toLagosParts(date);
  const dayOk = window.days.includes(p.weekday);
  const timeOk = p.minutesOfDay >= start && p.minutesOfDay < end;
  if (dayOk && timeOk) return { allowed: true, reason: null, nextOpenAt: null };

  const reason = !dayOk
    ? `${DAY_NAMES[p.weekday]} is not an allowed day.`
    : `${formatHHMM(p.minutesOfDay)} WAT is outside ${window.start}-${window.end} WAT.`;

  return { allowed: false, reason, nextOpenAt: nextWindowOpen(date, window) };
}

function nextWindowOpen(date: Date, window: TimeWindow): Date | null {
  if (window.days.length === 0) return null;
  const start = parseHHMM(window.start);
  const p = toLagosParts(date);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = fromLagosParts(p.year, p.month, p.day + offset, Math.floor(start / 60), start % 60);
    const cp = toLagosParts(candidate);
    if (candidate.getTime() > date.getTime() && window.days.includes(cp.weekday)) return candidate;
  }
  return null;
}

export function isWithinCallingWindow(date: Date, window: TimeWindow = DEFAULT_CALLING_WINDOW): WindowCheck {
  return checkWindow(date, window);
}

export function isWithinBookingWindow(date: Date, window: TimeWindow = DEFAULT_BOOKING_WINDOW): WindowCheck {
  return checkWindow(date, window);
}

// ---------------------------------------------------------------------------
// Appointments: appointment_date "YYYY-MM-DD", appointment_time "HH:MM" in WAT.
// ---------------------------------------------------------------------------

export interface AppointmentCheck {
  valid: boolean;
  errors: string[];
  /** The appointment as a real moment in time (when the format is valid). */
  startsAt: Date | null;
}

export function validateAppointment(
  appointmentDate: string,
  appointmentTime: string,
  options: { now?: Date; window?: TimeWindow; durationMinutes?: number } = {},
): AppointmentCheck {
  const errors: string[] = [];
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointmentDate);
  if (!dm) errors.push("appointment_date must be YYYY-MM-DD.");

  let minutes: number | null = null;
  try {
    minutes = parseHHMM(appointmentTime);
  } catch {
    errors.push("appointment_time must be HH:MM in 24-hour time.");
  }
  if (!dm || minutes === null) return { valid: false, errors, startsAt: null };

  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const startsAt = fromLagosParts(y, mo, d, Math.floor(minutes / 60), minutes % 60);
  const check = toLagosParts(startsAt);
  if (check.year !== y || check.month !== mo || check.day !== d) {
    return { valid: false, errors: ["appointment_date is not a real calendar date."], startsAt: null };
  }

  const window = options.window ?? DEFAULT_BOOKING_WINDOW;
  const duration = options.durationMinutes ?? 0;
  const inWindow = checkWindow(startsAt, window);
  if (!inWindow.allowed) errors.push(`Outside booking hours: ${inWindow.reason}`);
  else if (minutes + duration > parseHHMM(window.end)) errors.push(`The appointment would end after ${window.end} WAT.`);

  const now = options.now ?? new Date();
  if (startsAt.getTime() <= now.getTime()) errors.push("The appointment is in the past.");

  return { valid: errors.length === 0, errors, startsAt };
}

// ---------------------------------------------------------------------------
// Time of day, greetings and goodbyes
// ---------------------------------------------------------------------------

export type TimeOfDay = "morning" | "afternoon" | "evening";

export function getTimeOfDay(date: Date): TimeOfDay {
  const { hour } = toLagosParts(date);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

export function getGreeting(date: Date): string {
  return `Good ${getTimeOfDay(date)}`;
}

export type GoodbyeKind = "weekend" | "evening" | "day";

export interface Goodbye {
  kind: GoodbyeKind;
  text: string;
}

export const GOODBYE_LINES: Record<GoodbyeKind, string> = {
  weekend: "Have a lovely weekend.",
  evening: "Have a good evening.",
  day: "Have a great day.",
};

/**
 * Weekend = Friday from 15:00, Saturday, or Sunday before 17:00.
 * Otherwise evening (from 17:00) or day (morning and afternoon).
 */
export function chooseGoodbye(date: Date): Goodbye {
  const p = toLagosParts(date);
  const tod = getTimeOfDay(date);
  const weekend =
    (p.weekday === 5 && p.hour >= 15) || p.weekday === 6 || (p.weekday === 0 && p.hour < 17);
  const kind: GoodbyeKind = weekend ? "weekend" : tod === "evening" ? "evening" : "day";
  return { kind, text: GOODBYE_LINES[kind] };
}
