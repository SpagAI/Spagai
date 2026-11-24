/** Pure helper (no network), so it can be tested. */

/**
 * The language the agent must reply in, from the agent's Language setting (nothing for English).
 * Pidgin needs a firm rule: tested on 24 Nov 2026, a loose "speak Pidgin" drifted into standard
 * English after a few turns, while this kept every reply in Pidgin (docs/DECISIONS.md D172).
 */
export function languageLine(language: string | null | undefined): string | null {
  if (language === "pcm") {
    return 'Language: reply ONLY in Nigerian Pidgin, every single turn, for the whole call, even when explaining numbers or saying goodbye. Do not switch to standard English unless the caller clearly asks for English. Sound like a Lagos phone conversation, for example "I dey call you about...", "Make I explain am", "No wahala", "I go do am sharp sharp". Write numbers in words a voice can read ("five percent", "fifty thousand naira"), not symbols. The caller may speak Pidgin, English or a mix: understand all of it.';
  }
  const names: Record<string, string> = { yo: "Yoruba", ha: "Hausa", ig: "Igbo" };
  const name = names[language ?? ""];
  return name ? `Language: reply in ${name} every turn, unless the caller clearly prefers English or Pidgin. Write numbers in words a voice can read, not symbols.` : null;
}

/** Every {{placeholder}} in a text, sorted, with repeats (so a rewrite must keep each one, exactly). */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!).sort();
}

const REWRITE_LANGUAGE: Record<string, string> = {
  "en-NG": "clear, friendly Nigerian English",
  pcm: "natural Nigerian Pidgin, the way people in Lagos talk on the phone (for example \"na\", \"dey\", \"wetin\", \"make we\", \"abeg\")",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
};

export function canRewriteInto(language: string): boolean {
  return language in REWRITE_LANGUAGE;
}

/** The instruction for the AI that rewrites an agent's first message in another language. */
export function firstMessageRewriteInstruction(language: string): string {
  return [
    `Rewrite the opening line that a phone agent says at the start of a call, in ${REWRITE_LANGUAGE[language] ?? "English"}.`,
    "Keep the meaning, the tone and roughly the length. If it says the agent is an AI assistant, keep that.",
    "Keep every placeholder in double curly braces exactly as written, untranslated, for example {{agent_name}} and {{company_name}}.",
    "Reply with the rewritten line only: no quotes, no notes, no explanation.",
  ].join(" ");
}

/** Clean the AI's rewrite and check it kept every placeholder; null if it is not usable. */
export function acceptRewrite(original: string, rewrite: string): string | null {
  const text = rewrite.trim().replace(/^["“'](.*)["”']$/s, "$1").trim();
  if (!text || text.length > 1000) return null;
  return JSON.stringify(placeholdersOf(text)) === JSON.stringify(placeholdersOf(original)) ? text : null;
}
