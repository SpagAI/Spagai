/** Shapes the dashboard charts receive (plain data, safe to send to the browser). */

export interface Totals {
  /** Calls placed (answered + missed; blocked and failed attempts are not calls). */
  calls: number;
  answered: number;
  missed: number;
  booked: number;
  avgSeconds: number;
  costKobo: number;
}

export interface DayPoint {
  day: string; // YYYY-MM-DD, Lagos time
  answered: number;
  missed: number;
  booked: number;
  costKobo: number;
  avgSeconds: number;
}

export interface LocationRow {
  continent: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lng: number;
  calls: number;
  answered: number;
}

export interface DashboardData {
  days: number;
  current: Totals;
  previous: Totals;
  series: DayPoint[];
  hours: { hour: number; calls: number; answered: number }[];
  durations: { label: string; calls: number }[];
  agents: { id: string; name: string; calls: number; answered: number; booked: number; avgSeconds: number }[];
  locations: LocationRow[];
}

/** Percentage change from `before` to `now`, or null when there is nothing to compare with. */
export function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

/** 125 → "2:05" */
export function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/** 12_345_600 kobo → "₦123,456" (whole naira; the dashboard does not need kobo). */
export function naira(kobo: number): string {
  return `₦${new Intl.NumberFormat("en").format(Math.round(kobo / 100))}`;
}

/** A round axis maximum at or above `max`, with `steps` equal gridlines. */
export function niceMax(max: number, steps = 4): number {
  if (max <= 0) return steps;
  const raw = max / steps;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return step * steps;
}

/** 1284 → "1,284"; 12900 → "12.9K" */
export function compact(n: number): string {
  if (Math.abs(n) >= 10_000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat("en").format(n);
}
