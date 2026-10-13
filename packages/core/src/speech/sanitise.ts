/**
 * Spoken-text sanitiser. Runs on every line BEFORE it goes to text-to-speech.
 *
 * Real test calls showed agents reading "slash", "asterisk" and markdown aloud.
 * This turns written text into something a voice can say naturally:
 *   "Hi Mr. Okafor! Your **₦25,000** repayment is due 15/10/2026 at 9:30am."
 *   -> "Hi mister Okafor! Your twenty-five thousand naira repayment is due
 *       the fifteenth of October, twenty twenty-six at nine thirty in the morning."
 */

import { emailToSpeech } from "../email";
import { phoneToSpeech } from "../phone";
import {
  decimalToWords,
  digitsToWords,
  integerToWords,
  ordinalToWords,
  yearToWords,
} from "../shared/numberWords";

export interface SanitiseOptions {
  /** Expand Mr -> mister, Dr -> doctor, etc. Default true. */
  expandTitles?: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_RE = MONTHS.join("|");

const DAYS: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", tues: "Tuesday", wed: "Wednesday", thu: "Thursday",
  thur: "Thursday", thurs: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DAY_ABBR_RE = "Mon|Tues?|Wed|Thu(?:rs?)?|Fri|Sat|Sun";

export const SPOKEN_TITLES: Record<string, string> = {
  Mr: "mister",
  Mrs: "missus",
  Ms: "miz",
  Dr: "doctor",
  Engr: "engineer",
  Barr: "barrister",
  Prof: "professor",
  Rev: "reverend",
  Hon: "honourable",
  Arc: "architect",
  Pharm: "pharmacist",
};

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\be\.g\.(?=\s|,|$)/gi, "for example"],
  [/\bi\.e\.(?=\s|,|$)/gi, "that is"],
  [/\betc\.?(?=\s|,|$)/gi, "and so on"],
  [/\bvs\.?(?=\s)/gi, "versus"],
  [/\bapprox\.(?=\s)/gi, "about"],
  [/\bno\.\s?(?=\d)/gi, "number "],
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ng|org|net|io|ai|co|africa)(?:\.[a-z]{2})?(?:\/[^\s)]*[^\s).,!?;:])?/gi;
const NG_PHONE_RE = /(?<![\d])(?:\+?234[\s-]?|0)[789][01]\d(?:[\s-]?\d){7}(?![\d])/g;
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}️‍⃣]/gu;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function wholeNumberWords(raw: string): string {
  return integerToWords(Number(raw.replace(/,/g, "")));
}

/** "25,000" / "1.5" + "m" -> words for an amount of money. */
function moneyToWords(amount: string, scale: string | undefined, unit: string, subunit: string | null): string {
  const clean = amount.replace(/,/g, "");
  const s = (scale ?? "").trim().toLowerCase();
  const multiplier =
    s === "k" || s === "thousand" ? 1e3
    : s === "m" || s === "million" ? 1e6
    : s === "b" || s === "bn" || s === "billion" ? 1e9
    : 1;

  if (multiplier > 1) {
    const total = Math.round(Number(clean) * multiplier);
    return `${integerToWords(total)} ${unit}`;
  }
  const [whole, fraction] = clean.split(".");
  let words = `${integerToWords(Number(whole))} ${unit}`;
  if (fraction && subunit) {
    const sub = Number(fraction.padEnd(2, "0").slice(0, 2));
    if (sub > 0) words += ` and ${integerToWords(sub)} ${subunit}`;
  }
  return words;
}

function timeToWords(hour: number, minute: number, meridiem: "am" | "pm" | null): string {
  let h24 = hour;
  if (meridiem === "am" && hour === 12) h24 = 0;
  if (meridiem === "pm" && hour < 12) h24 = hour + 12;

  if (h24 === 0 && minute === 0) return "midnight";
  if (h24 === 12 && minute === 0) return "twelve noon";

  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minutes = minute === 0 ? "" : minute < 10 ? ` oh ${integerToWords(minute)}` : ` ${integerToWords(minute)}`;
  const period =
    h24 < 5 ? "at night"
    : h24 < 12 ? "in the morning"
    : h24 < 17 ? "in the afternoon"
    : "in the evening";
  return `${integerToWords(h12)}${minutes} ${period}`;
}

function dateToWords(day: number, month: number, year: number | null): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const base = `the ${ordinalToWords(day)} of ${MONTHS[month - 1]}`;
  return year ? `${base}, ${yearToWords(year)}` : base;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function sanitiseForSpeech(input: string, options: SanitiseOptions = {}): string {
  const expandTitles = options.expandTitles ?? true;
  let t = input;

  // 1. Emails and websites first, before we strip their symbols.
  t = t.replace(EMAIL_RE, (m) => emailToSpeech(m));
  t = t.replace(URL_RE, (m) =>
    m
      .replace(/^https?:\/\//i, "")
      .replace(/\/$/, "")
      .replace(/\./g, " dot ")
      .replace(/\//g, " slash ")
      .replace(/-/g, " dash "),
  );

  // 2. Markdown.
  t = t
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, ""))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]*)`/g, "$1");

  // 3. Emoji.
  t = t.replace(EMOJI_RE, "");

  // 4. Abbreviations like e.g. / i.e. / etc.
  for (const [re, spoken] of ABBREVIATIONS) t = t.replace(re, spoken);
  t = t.replace(/\band\/or\b/gi, "and or").replace(/\b24\/7\b/g, "twenty-four seven");

  // 5. Nigerian phone numbers -> digit groups.
  t = t.replace(NG_PHONE_RE, (m) => phoneToSpeech(m));

  // 6. Money: ₦25,000 / N25,000 / NGN 25000 / ₦1.5m / $40.
  t = t.replace(
    /(?:₦|\bNGN\s?|\bN(?=\d))\s?(\d[\d,]*(?:\.\d+)?)(\s?(?:k|m|bn|b|thousand|million|billion)\b)?/gi,
    (_m, amount: string, scale?: string) => moneyToWords(amount, scale, "naira", "kobo"),
  );
  t = t.replace(
    /\$\s?(\d[\d,]*(?:\.\d+)?)(\s?(?:k|m|bn|b|thousand|million|billion)\b)?/gi,
    (_m, amount: string, scale?: string) => moneyToWords(amount, scale, "dollars", "cents"),
  );

  // 7. Percentages.
  t = t.replace(/(\d+(?:\.\d+)?)\s?%/g, (_m, n: string) => `${decimalToWords(n)} percent`);

  // 8. Dates. ISO first (2026-10-15), then Nigerian day-first (15/10/2026, 15-10-2026).
  t = t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y: string, mo: string, d: string) =>
    dateToWords(Number(d), Number(mo), Number(y)) ?? m,
  );
  t = t.replace(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, (m, d: string, mo: string, y: string) =>
    dateToWords(Number(d), Number(mo), Number(y)) ?? m,
  );
  // "15th October 2026" / "15 October" -> "the fifteenth of October, twenty twenty-six"
  t = t.replace(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})(?:,?\\s+(\\d{4}))?\\b`, "g"),
    (m, d: string, month: string, y?: string) =>
      dateToWords(Number(d), MONTHS.indexOf(month) + 1, y ? Number(y) : null) ?? m,
  );
  // "October 15th, 2026" / "October 2026"
  t = t.replace(
    new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "g"),
    (m, month: string, d: string, y?: string) =>
      dateToWords(Number(d), MONTHS.indexOf(month) + 1, y ? Number(y) : null) ?? m,
  );
  t = t.replace(new RegExp(`\\b(${MONTH_RE}),?\\s+(\\d{4})\\b`, "g"), (_m, month: string, y: string) =>
    `${month} ${yearToWords(Number(y))}`,
  );

  // 9. Times: "9:30am", "9 pm", "14:00", "9:30 WAT".
  t = t.replace(
    /\b(\d{1,2})(?::([0-5]\d))?\s?(a\.m\.|p\.m\.|am|pm)(?=\s|[,.!?;]|$)/gi,
    (m, h: string, min: string | undefined, mer: string) => {
      const hour = Number(h);
      if (hour < 1 || hour > 12) return m;
      return timeToWords(hour, Number(min ?? 0), mer.toLowerCase().startsWith("a") ? "am" : "pm");
    },
  );
  t = t.replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g, (_m, h: string, min: string) =>
    timeToWords(Number(h), Number(min), null),
  );
  t = t.replace(/\s+\b(WAT|GMT\+1)\b/g, "");

  // 10. Ordinals: 1st, 22nd.
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_m, n: string) => ordinalToWords(Number(n)));

  // 11. Titles: "Mr. Okafor" -> "mister Okafor".
  if (expandTitles) {
    const titleRe = new RegExp(`\\b(${Object.keys(SPOKEN_TITLES).join("|")})\\.?(?=\\s+[A-Z])`, "g");
    t = t.replace(titleRe, (_m, title: string) => SPOKEN_TITLES[title]!);
  }

  // 12a. Day ranges "Mon-Fri" -> "Monday to Friday"; lone "Mon" -> "Monday".
  t = t.replace(new RegExp(`\\b(${DAY_ABBR_RE})\\.?\\s?[-–]\\s?(${DAY_ABBR_RE})\\b\\.?`, "g"), (_m, a: string, b: string) =>
    `${DAYS[a.toLowerCase()]} to ${DAYS[b.toLowerCase()]}`,
  );
  t = t.replace(new RegExp(`\\b(${DAY_ABBR_RE})\\b\\.?(?=\\s|,|$)`, "g"), (_m, a: string) => DAYS[a.toLowerCase()]!);

  // 12. Number ranges "9-5" -> "9 to 5" (before dashes are removed).
  t = t.replace(/(\d)\s?[-–]\s?(\d)/g, "$1 to $2");

  // 13. Remaining numbers.
  t = t.replace(/\d[\d,]*(?:\.\d+)?/g, (m) => {
    const plain = m.replace(/,$/, "");
    const trailingComma = m.endsWith(",") ? "," : "";
    if (/^0\d/.test(plain) || (!plain.includes(",") && !plain.includes(".") && plain.length >= 6)) {
      // Reference / account numbers: digit by digit.
      return digitsToWords(plain) + trailingComma;
    }
    if (plain.includes(".")) return decimalToWords(plain.replace(/,/g, "")) + trailingComma;
    return wholeNumberWords(plain) + trailingComma;
  });

  // 14. Symbols a voice would read aloud.
  t = t
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+\+\s+/g, " plus ")
    .replace(/\s+=\s+/g, " equals ")
    .replace(/@/g, " at ")
    .replace(/\s+\/\s+/g, ", ")
    .replace(/(\p{L})\/(\p{L})/gu, "$1 or $2")
    .replace(/\//g, " ")
    .replace(/\s+[-–—]+\s+|[–—]+/g, ", ")
    .replace(/(\p{L})-(\p{L})/gu, "$1 $2")
    .replace(/\s*[([{]\s*/g, ", ")
    .replace(/\s*[)\]}]\s*/g, ", ")
    .replace(/[*#_~`|<>^\\"“”«»]/g, "")
    .replace(/-/g, " ");

  // 15. Tidy spacing and punctuation.
  t = t
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/,(\s*,)+/g, ",")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/([.!?])\s*,/g, "$1")
    .replace(/(^|\n),\s*/g, "$1")
    .replace(/,\s*$/gm, "")
    .replace(/,(?=\S)/g, ", ")
    .replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_m, before: string, ch: string) => before + ch.toUpperCase())
    .trim();

  return t;
}
