import "server-only";
import { env } from "../env";
import { fishModelToBankVoice, isFishVoiceId, type BankVoice } from "@/lib/voice-bank";

/**
 * Fish Audio adapter: search its public voice library, look up one voice, and turn text into speech.
 * Docs: https://docs.fish.audio — the key is sent as "Authorization: Bearer <FISH_AUDIO_API_KEY>".
 */
const BASE = "https://api.fish.audio";

export function fishAudioConfigured(): boolean {
  return Boolean(env.FISH_AUDIO_API_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${env.FISH_AUDIO_API_KEY}`, ...extra };
}

export interface BankSearch {
  query: string;
  gender: "" | "female" | "male";
  page: number;
}

export interface BankPage {
  voices: BankVoice[];
  total: number;
  page: number;
  hasMore: boolean;
}

export const BANK_PAGE_SIZE = 12;

/** Search the public Fish Audio voice library. */
export async function searchFishVoices({ query, gender, page }: BankSearch): Promise<BankPage> {
  const params = new URLSearchParams({ page_size: String(BANK_PAGE_SIZE), page_number: String(page), sort_by: "score" });
  if (query) params.set("title", query);
  if (gender) params.set("tag", gender);
  const res = await fetch(`${BASE}/model?${params}`, { headers: headers(), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Fish Audio voice search failed (${res.status}).`);
  const data = (await res.json()) as { total?: unknown; items?: unknown[] };
  const voices = (data.items ?? []).map(fishModelToBankVoice).filter((v): v is BankVoice => v !== null);
  const total = typeof data.total === "number" ? data.total : voices.length;
  return { voices, total, page, hasMore: page * BANK_PAGE_SIZE < total };
}

/** Look up one voice by its Fish Audio id (used when adding it, so its details come from Fish Audio). */
export async function getFishVoice(providerVoiceId: string): Promise<BankVoice | null> {
  if (!isFishVoiceId(providerVoiceId)) return null;
  const res = await fetch(`${BASE}/model/${providerVoiceId}`, { headers: headers(), signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Fish Audio voice lookup failed (${res.status}).`);
  return fishModelToBankVoice(await res.json());
}

/** Turn already-cleaned text into MP3 speech in one Fish Audio voice. */
export async function fishTextToSpeech(providerVoiceId: string, text: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/v1/tts`, {
    method: "POST",
    headers: headers({ "content-type": "application/json", model: env.FISH_AUDIO_MODEL }),
    body: JSON.stringify({ text, reference_id: providerVoiceId, format: "mp3", mp3_bitrate: 64, normalize: true, latency: "balanced" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 402) throw new SpeechError("Your Fish Audio account has run out of credit.");
  if (res.status === 401 || res.status === 403) throw new SpeechError("Fish Audio did not accept the API key.");
  if (!res.ok) throw new SpeechError(`Fish Audio could not create the speech (${res.status}).`);
  return res.arrayBuffer();
}

/** An error whose message is safe to show to the user. */
export class SpeechError extends Error {}
