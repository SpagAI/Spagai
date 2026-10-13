/**
 * Nigerian phone number tools.
 *
 * Accepts: 08031234567, 8031234567, 2348031234567, +2348031234567, 002348031234567,
 * and messy versions with spaces, dashes, dots or brackets ("+234 (0) 803-123-4567").
 * Returns E.164 (+2348031234567).
 *
 * Only mobile numbers are accepted for now: 10 national digits starting 70x, 80x, 81x, 90x, 91x.
 */

import { DIGIT_WORDS } from "../shared/numberWords";

export interface PhoneParseResult {
  valid: boolean;
  /** "+2348031234567" when valid. */
  e164: string | null;
  /** Local format "08031234567" when valid. */
  national: string | null;
  /** Plain-English reason when invalid. */
  reason: string | null;
  input: string;
}

const NIGERIA_MOBILE_NSN = /^[789][01]\d{8}$/;

export function parseNigerianPhone(input: string | null | undefined): PhoneParseResult {
  const raw = (input ?? "").trim();
  const fail = (reason: string): PhoneParseResult => ({ valid: false, e164: null, national: null, reason, input: raw });

  if (!raw) return fail("Phone number is empty.");
  if (/[a-z]/i.test(raw)) return fail("Phone number contains letters.");

  // Keep a leading "+" if present, drop everything else that is not a digit.
  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");

  if (hasPlus && !digits.startsWith("234")) {
    return fail("Not a Nigerian number (country code is not +234).");
  }

  if (digits.startsWith("00234")) digits = digits.slice(5);
  else if (digits.startsWith("234") && digits.length >= 12) digits = digits.slice(3);
  else if (hasPlus && digits.startsWith("234")) digits = digits.slice(3);

  // "+234 (0) 803..." or "2340803..." -> drop the trunk zero after the country code.
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length < 10) {
    return fail(`Too short: ${digits.length + 1} digits in local format. Nigerian mobile numbers have 11 (e.g. 08031234567). A digit may be missing.`);
  }
  if (digits.length > 10) {
    return fail("Too long for a Nigerian mobile number.");
  }
  if (!NIGERIA_MOBILE_NSN.test(digits)) {
    return fail("Not a recognised Nigerian mobile prefix (expected 070, 080, 081, 090 or 091).");
  }

  return { valid: true, e164: `+234${digits}`, national: `0${digits}`, reason: null, input: raw };
}

/** "+2348031234567" -> "0803 123 4567" (for screens). */
export function formatNigerianPhone(e164OrLocal: string): string {
  const parsed = parseNigerianPhone(e164OrLocal);
  if (!parsed.national) return e164OrLocal;
  const n = parsed.national;
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}

/**
 * Read a number back on a call in digit groups, with commas so the voice pauses:
 * "+2348031234567" -> "zero eight zero three, one two three, four five six seven".
 */
export function phoneToSpeech(e164OrLocal: string): string {
  const parsed = parseNigerianPhone(e164OrLocal);
  const n = parsed.national ?? e164OrLocal.replace(/\D/g, "");
  const groups = parsed.national ? [n.slice(0, 4), n.slice(4, 7), n.slice(7)] : n.match(/.{1,3}/g) ?? [];
  return groups.map((g) => g.split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ")).join(", ");
}
