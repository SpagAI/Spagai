/**
 * Voice catalogue (starter data). The database copy is built from this in M3.
 * Language codes: en-NG (Nigerian English), pcm (Nigerian Pidgin), yo (Yoruba), ha (Hausa), ig (Igbo).
 * Non-English sample lines are placeholders and need checking by native speakers.
 */

import data from "../../data/voices.json";

export type VoiceLanguage = "en-NG" | "pcm" | "yo" | "ha" | "ig";
export type VoiceStatus = "available" | "not_configured" | "disabled";

export interface Voice {
  id: string;
  name: string;
  language: VoiceLanguage;
  gender: "female" | "male";
  provider: string;
  providerVoiceId: string;
  sampleText: string;
  status: VoiceStatus;
  /** e.g. "Conversational", "Sales", "Customer service", "Professional", "Narration" */
  category: string;
  /** e.g. "Nigerian", "British", "American" */
  accent: string;
  description: string;
  age: "young" | "middle" | "mature";
}

/** Voice providers in display order. "openai_compatible" is your own connected server. */
export const VOICE_PROVIDERS: Record<string, string> = {
  spagai: "Spag AI",
  elevenlabs: "ElevenLabs",
  cartesia: "Cartesia",
  openai: "OpenAI",
  openai_compatible: "Your provider",
};

export const VOICE_CATEGORIES = ["Conversational", "Customer service", "Sales", "Professional", "Narration"] as const;

export const LANGUAGE_NAMES: Record<VoiceLanguage, string> = {
  "en-NG": "English (Nigeria)",
  pcm: "Nigerian Pidgin",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
};

export const VOICE_CATALOGUE: Voice[] = data.voices as Voice[];

export function getVoice(id: string | null | undefined): Voice | undefined {
  return VOICE_CATALOGUE.find((v) => v.id === id);
}
