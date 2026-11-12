/**
 * Voice bank helpers (pure, no network): turn a voice from an outside library (Fish Audio)
 * into the shape Spag AI uses, and build or read the ids agents store.
 *
 * Agents refer to a bank voice as "<provider>:<providerVoiceId>", e.g. "fish_audio:90170ece…".
 */
import { DEFAULT_VOICE_SETTINGS, type Voice, type VoiceLanguage, type VoiceSettings } from "@spagai/core";

export const FISH_PROVIDER = "fish_audio";

/** Fish Audio's public sample files. Only these are played in the browser. */
const FISH_SAMPLE_PREFIX = "https://platform.r2.fish.audio/";
const FISH_ID = /^[a-f0-9]{32}$/;

export interface BankVoice {
  providerVoiceId: string;
  name: string;
  gender: "female" | "male";
  age: Voice["age"];
  language: VoiceLanguage;
  accent: string;
  category: string;
  description: string;
  /** Free sample recording on the provider's servers, or null. */
  sampleUrl: string | null;
  likes: number;
  uses: number;
}

export function isFishVoiceId(id: string): boolean {
  return FISH_ID.test(id);
}

export function bankVoiceId(provider: string, providerVoiceId: string): string {
  return `${provider}:${providerVoiceId}`;
}

export function parseBankVoiceId(voiceId: string | null | undefined): { provider: string; providerVoiceId: string } | null {
  const m = /^(fish_audio):([a-f0-9]{32})$/.exec(voiceId ?? "");
  return m ? { provider: m[1]!, providerVoiceId: m[2]! } : null;
}

const LANGUAGES: Record<string, VoiceLanguage> = { yo: "yo", ha: "ha", ig: "ig", pcm: "pcm" };

const ACCENTS: [RegExp, string][] = [
  [/nigeria|naija|lagos|yoruba|igbo|hausa/i, "Nigerian"],
  [/ghana/i, "Ghanaian"],
  [/kenya/i, "Kenyan"],
  [/south african/i, "South African"],
  [/british|london|uk\b/i, "British"],
  [/american|\busa?\b/i, "American"],
];

function category(tags: string[]): string {
  const has = (...t: string[]) => t.some((x) => tags.includes(x));
  if (has("customer-service", "support")) return "Customer service";
  if (has("sales", "advertisement", "marketing")) return "Sales";
  if (has("conversational")) return "Conversational";
  if (has("narration", "narrative", "storytelling", "audiobook")) return "Narration";
  if (has("educational", "professional", "news")) return "Professional";
  return "Conversational";
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Map one Fish Audio model (from GET /model) to a BankVoice. Returns null for unusable entries. */
export function fishModelToBankVoice(model: unknown): BankVoice | null {
  if (!model || typeof model !== "object") return null;
  const m = model as Record<string, unknown>;
  const id = text(m._id);
  if (!isFishVoiceId(id)) return null;
  if (m.type !== undefined && m.type !== "tts") return null;
  if (m.state !== undefined && m.state !== "trained") return null;

  const tags = Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase()) : [];
  const languages = Array.isArray(m.languages) ? m.languages.filter((l): l is string => typeof l === "string") : [];
  const name = text(m.title).slice(0, 80) || "Untitled voice";
  const description = text(m.description).slice(0, 240);
  const haystack = `${name} ${description} ${tags.join(" ")}`;
  const samples = Array.isArray(m.samples) ? m.samples : [];
  const firstAudio = samples.map((s) => (s && typeof s === "object" ? text((s as Record<string, unknown>).audio) : "")).find(Boolean) ?? "";

  return {
    providerVoiceId: id,
    name,
    gender: tags.includes("male") && !tags.includes("female") ? "male" : "female",
    age: tags.includes("young") ? "young" : tags.some((t) => ["old", "elderly", "senior", "mature"].includes(t)) ? "mature" : "middle",
    language: LANGUAGES[languages[0] ?? ""] ?? "en-NG",
    accent: ACCENTS.find(([re]) => re.test(haystack))?.[1] ?? "Other",
    category: category(tags),
    description,
    sampleUrl: firstAudio.startsWith(FISH_SAMPLE_PREFIX) ? firstAudio : null,
    likes: typeof m.like_count === "number" ? m.like_count : 0,
    uses: typeof m.task_count === "number" ? m.task_count : 0,
  };
}

export interface WorkspaceVoiceRow {
  provider: string;
  providerVoiceId: string;
  name: string;
  gender: string;
  language: string;
  accent: string;
  description: string;
  age: string;
}

const SAMPLE_LINE = "Good morning. Thank you for your time today. How may I help you?";

/** Fish Audio titles that describe a voice rather than name it ("Female Nigerian", "nigeria voice"). */
const GENERIC_TITLE = /nigeria|naija|voice|female|male|woman|\bman\b|girl|boy|lady|narrator|storyteller|speaker|english|official|accent/i;
const FEMALE_NAMES = ["Ifeoma", "Halima", "Damilola", "Uche", "Hauwa", "Tolani", "Ebere", "Aisha", "Kelechi", "Simisola"];
const MALE_NAMES = ["Kunle", "Nnamdi", "Sani", "Dayo", "Ikenna", "Yusuf", "Gbenga", "Uchenna", "Bayo", "Kabiru"];

/** A person's name for a voice: its own if it has one, else a Nigerian first name picked from its id. */
export function friendlyVoiceName(title: string, gender: string, id: string): string {
  const clean = title.trim();
  if (clean && !GENERIC_TITLE.test(clean)) return clean;
  const pool = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
  const n = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  return pool[n % pool.length]!;
}

/** A saved workspace voice in the same shape as the built-in catalogue voices. */
export function workspaceVoiceToVoice(row: WorkspaceVoiceRow): Voice {
  return {
    id: bankVoiceId(row.provider, row.providerVoiceId),
    name: friendlyVoiceName(row.name, row.gender, row.providerVoiceId),
    language: (["en-NG", "pcm", "yo", "ha", "ig"].includes(row.language) ? row.language : "en-NG") as VoiceLanguage,
    gender: row.gender === "male" ? "male" : "female",
    provider: row.provider,
    providerVoiceId: row.providerVoiceId,
    sampleText: SAMPLE_LINE,
    status: "available",
    category: "Conversational",
    accent: row.accent,
    description: row.description,
    age: row.age === "young" || row.age === "mature" ? row.age : "middle",
  };
}

/** The Fish Audio text-to-speech request for a voice, a line and the agent's voice settings. */
export function fishTtsBody(providerVoiceId: string, text: string, settings: VoiceSettings = DEFAULT_VOICE_SETTINGS) {
  return {
    text,
    reference_id: providerVoiceId,
    format: "mp3",
    mp3_bitrate: 64,
    latency: "balanced",
    normalize: settings.naturalNumbers,
    temperature: Math.round(settings.expressiveness * 100) / 100,
    prosody: { speed: settings.speed, volume: settings.volume },
  };
}

/** Browser demo voices: the agent's speed and loudness as speech settings (volume 0 to 1, louder than 1 is not possible). */
export function browserSpeechSettings(settings: VoiceSettings = DEFAULT_VOICE_SETTINGS): { rate: number; volume: number } {
  return { rate: settings.speed, volume: settings.volume >= 0 ? 1 : Math.max(0.2, 1 + settings.volume * 0.08) };
}
