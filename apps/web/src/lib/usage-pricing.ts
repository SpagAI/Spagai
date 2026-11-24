/**
 * What each paid outside service costs, from their published prices (US dollars). Pure, so it can be
 * tested. Estimates only: the real bills come from Groq and Fish Audio. See docs/DECISIONS.md D157.
 */

export type UsageKind = "ai_input_tokens" | "ai_output_tokens" | "ai_replies" | "voice_characters" | "yarngpt_characters" | "listening_seconds";

export interface PriceLine {
  provider: string;
  what: string;
  /** Dollars per unit of quantity. */
  usdPerUnit: number;
  unit: string;
}

/** Published prices (checked November 2026). */
export const PRICES: Partial<Record<UsageKind, PriceLine>> = {
  // Groq, openai/gpt-oss-120b: $0.15 per million input tokens, $0.60 per million output tokens.
  ai_input_tokens: { provider: "Groq", what: "AI brain: words read (prompt and conversation)", usdPerUnit: 0.15 / 1_000_000, unit: "tokens" },
  ai_output_tokens: { provider: "Groq", what: "AI brain: words written (replies and thinking)", usdPerUnit: 0.6 / 1_000_000, unit: "tokens" },
  // Fish Audio: $15 per million UTF-8 bytes (about one byte per English character).
  voice_characters: { provider: "Fish Audio", what: "Voice: characters spoken", usdPerUnit: 15 / 1_000_000, unit: "characters" },
  // Groq Whisper large v3: $0.111 per hour of audio, at least 10 seconds per recording (recorded already rounded up).
  listening_seconds: { provider: "Groq", what: "Listening: seconds of audio written down", usdPerUnit: 0.111 / 3600, unit: "seconds" },
};

/** Groq bills at least 10 seconds for every recording. */
export function billedListeningSeconds(durationSeconds: number): number {
  return Math.max(10, Math.ceil(durationSeconds || 0));
}

export function costUsd(kind: UsageKind, quantity: number): number {
  return (PRICES[kind]?.usdPerUnit ?? 0) * quantity;
}

export type UsageTotals = Partial<Record<UsageKind, number>>;

/** The three easy groups the Usage page shows, with quantity and cost. */
export function summarise(totals: UsageTotals) {
  const q = (k: UsageKind) => totals[k] ?? 0;
  const ai = costUsd("ai_input_tokens", q("ai_input_tokens")) + costUsd("ai_output_tokens", q("ai_output_tokens"));
  // YarnGPT is paid in YarnGPT credits whose price is only shown on its account page, so it has no
  // dollar price here: its characters are counted and shown, but not added to the cost.
  const voice = costUsd("voice_characters", q("voice_characters"));
  const listening = costUsd("listening_seconds", q("listening_seconds"));
  return {
    ai: { usd: ai, replies: q("ai_replies"), tokensIn: q("ai_input_tokens"), tokensOut: q("ai_output_tokens") },
    voice: { usd: voice, characters: q("voice_characters"), yarngptCharacters: q("yarngpt_characters") },
    listening: { usd: listening, minutes: q("listening_seconds") / 60 },
    totalUsd: ai + voice + listening,
  };
}

/** "$0.0123" for small amounts, "$1.23" otherwise. */
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** For a rough naira figure next to dollars (providers bill in dollars). */
export const NAIRA_PER_USD = 1600;
