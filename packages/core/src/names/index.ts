/**
 * Name pronunciation dictionary (starter list).
 * STATUS: to be verified by native Yoruba, Igbo and Hausa speakers.
 */

import data from "../../data/names-pronunciation.json";

export type NameLanguage = "yo" | "ig" | "ha";

export interface NamePronunciation {
  name: string;
  language: NameLanguage;
  /** Rough English-style spelling, e.g. "chee-NEH-doo". Tones are not shown. */
  hint: string;
  verified: boolean;
}

export const NAME_DICTIONARY_STATUS: string = data.status;
export const NAME_PRONUNCIATIONS: NamePronunciation[] = data.names as NamePronunciation[];

const BY_NAME = new Map(NAME_PRONUNCIATIONS.map((n) => [n.name.toLowerCase(), n]));

export function getNamePronunciation(name: string): NamePronunciation | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}
