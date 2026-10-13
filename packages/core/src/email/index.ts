/**
 * Email tools.
 *
 * 1. normaliseSpokenEmail: what the caller SAID -> the stored value.
 *    "john underscore doe at gmail dot com" -> "john_doe@gmail.com"
 *    "ada dot obi gmail"                    -> "ada.obi@gmail.com"
 * 2. emailToSpeech: the stored value -> what the agent SAYS.
 *    "john_doe@gmail.com" -> "john underscore doe at gmail dot com"
 *
 * Symbols (@ . _ -) live only in stored values. They are never spoken.
 */

import { DIGIT_WORDS } from "../shared/numberWords";

export interface SpokenEmailResult {
  email: string;
  valid: boolean;
  /** Plain-English reason when invalid. */
  reason: string | null;
}

/** Webmail providers callers often say on their own ("my email is chidi gmail"). */
export const KNOWN_EMAIL_PROVIDERS: Record<string, string> = {
  gmail: "gmail.com",
  googlemail: "googlemail.com",
  yahoo: "yahoo.com",
  ymail: "ymail.com",
  hotmail: "hotmail.com",
  outlook: "outlook.com",
  live: "live.com",
  icloud: "icloud.com",
};

const WORD_TO_SYMBOL: Record<string, string> = {
  at: "@",
  dot: ".", period: ".", point: ".",
  underscore: "_", "under-score": "_",
  dash: "-", hyphen: "-", minus: "-",
};

const DIGIT_WORD_TO_DIGIT: Record<string, string> = Object.fromEntries(
  DIGIT_WORDS.map((w, i) => [w, String(i)]),
);
DIGIT_WORD_TO_DIGIT["oh"] = "0";

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && !value.includes("..");
}

export function normaliseSpokenEmail(spoken: string): SpokenEmailResult {
  let text = spoken.trim().toLowerCase();

  // Multi-word phrases first.
  text = text
    .replace(/\bfull\s*stop\b/g, " dot ")
    .replace(/\bat\s+sign\b/g, " at ")
    .replace(/\bat\s+the\s+rate(\s+of)?\b/g, " at ")
    .replace(/\bg\s+mail\b/g, "gmail")
    .replace(/\bhot\s+mail\b/g, "hotmail")
    .replace(/\bdouble\s+([a-z0-9])\b/g, "$1$1");

  const tokens = text.split(/[\s,]+/).filter(Boolean);
  const out: string[] = [];

  tokens.forEach((token, i) => {
    if (token in WORD_TO_SYMBOL) {
      out.push(WORD_TO_SYMBOL[token]!);
      return;
    }
    if (token in DIGIT_WORD_TO_DIGIT) {
      out.push(DIGIT_WORD_TO_DIGIT[token]!);
      return;
    }
    // "chidi gmail" -> insert "@" before a known provider when nobody said "at".
    const prev = out[out.length - 1];
    if (token in KNOWN_EMAIL_PROVIDERS && prev !== "@" && prev !== "." && i > 0 && !out.includes("@")) {
      out.push("@");
    }
    out.push(token);
  });

  let email = out.join("").replace(/\.{2,}/g, ".").replace(/^[.@]+|[.@-]+$/g, "");

  // "@gmail" with no ending -> "@gmail.com".
  const at = email.lastIndexOf("@");
  if (at >= 0) {
    const domain = email.slice(at + 1);
    if (!domain.includes(".") && KNOWN_EMAIL_PROVIDERS[domain]) {
      email = `${email.slice(0, at + 1)}${KNOWN_EMAIL_PROVIDERS[domain]}`;
    }
  }

  if (!email.includes("@")) return { email, valid: false, reason: "No \"at\" was heard, so this is not a full email address." };
  if (!isValidEmail(email)) return { email, valid: false, reason: "This does not look like a complete email address." };
  return { email, valid: true, reason: null };
}

/** "ada.obi_2@gmail.com" -> "ada dot obi underscore two at gmail dot com" */
export function emailToSpeech(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/@/g, " at ")
    .replace(/\./g, " dot ")
    .replace(/_/g, " underscore ")
    .replace(/-/g, " dash ")
    .replace(/\+/g, " plus ")
    .replace(/\d/g, (d) => ` ${DIGIT_WORDS[Number(d)]} `)
    .replace(/\s+/g, " ")
    .trim();
}
