/**
 * Billing rules (M5). Money is always integer kobo (₦1 = 100 kobo), never floats.
 * Organisations prepay into a wallet; each answered call is charged per started minute.
 */

export const KOBO_PER_NAIRA = 100;

/** Default price per started minute of an answered call: ₦150. (founder may change) */
export const DEFAULT_RATE_PER_MINUTE_KOBO = 150 * KOBO_PER_NAIRA;

/** Top-up limits: ₦1,000 to ₦5,000,000. */
export const MIN_TOPUP_KOBO = 1_000 * KOBO_PER_NAIRA;
export const MAX_TOPUP_KOBO = 5_000_000 * KOBO_PER_NAIRA;

/** Whole minutes charged for a call: every started minute counts; unanswered calls are free. */
export function billableMinutes(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.ceil(durationSeconds / 60);
}

export function callCostKobo(durationSeconds: number, ratePerMinuteKobo: number): number {
  return billableMinutes(durationSeconds) * ratePerMinuteKobo;
}

/** A call may only start when the wallet covers at least one minute. */
export function canAffordCall(balanceKobo: number, ratePerMinuteKobo: number): boolean {
  return balanceKobo >= ratePerMinuteKobo;
}

/** 123450 → "₦1,234.50". Whole naira drop the kobo: 100000 → "₦1,000". */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(kobo));
  const naira = Math.floor(abs / KOBO_PER_NAIRA);
  const rest = abs % KOBO_PER_NAIRA;
  const grouped = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}₦${grouped}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

/**
 * Read an amount typed by a person ("5000", "₦5,000", "5,000.50", "N5000") into kobo.
 * Returns null for anything that is not a plain positive amount with at most 2 decimals.
 */
export function parseNairaInput(input: string): number | null {
  const cleaned = input.trim().replace(/^(₦|ngn|n)\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".") as [string, string?];
  const kobo = Number(whole) * KOBO_PER_NAIRA + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(kobo) && kobo > 0 ? kobo : null;
}

export function checkTopUp(kobo: number | null): { ok: true; kobo: number } | { ok: false; reason: string } {
  if (kobo === null) return { ok: false, reason: "Enter an amount in naira, for example 5000." };
  if (kobo < MIN_TOPUP_KOBO) return { ok: false, reason: `The smallest top-up is ${formatNaira(MIN_TOPUP_KOBO)}.` };
  if (kobo > MAX_TOPUP_KOBO) return { ok: false, reason: `The largest top-up is ${formatNaira(MAX_TOPUP_KOBO)}.` };
  return { ok: true, kobo };
}

/** How many minutes of calls the balance covers. */
export function minutesCovered(balanceKobo: number, ratePerMinuteKobo: number): number {
  return ratePerMinuteKobo > 0 ? Math.max(0, Math.floor(balanceKobo / ratePerMinuteKobo)) : 0;
}
