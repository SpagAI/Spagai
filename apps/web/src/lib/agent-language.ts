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
