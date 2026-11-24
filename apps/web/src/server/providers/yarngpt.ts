import "server-only";
import { env } from "../env";
import { SpeechError } from "./fish-audio";

/**
 * YarnGPT adapter: Nigerian voices (all 16 speak Pidgin, English, Yoruba, Hausa and Igbo).
 * Docs: https://yarngpt.ai/api-docs. The key is sent as "Authorization: Bearer <YARNGPT_API_KEY>".
 * Uses the "conversation" route, made for voice agents: the audio comes straight back (no job to poll).
 */
const BASE = "https://api.yarngpt.ai/api/v1";

/** The conversation route takes at most 5,000 characters. */
export const YARNGPT_MAX_CHARACTERS = 5000;

export function yarngptConfigured(): boolean {
  return Boolean(env.YARNGPT_API_KEY);
}

/** YarnGPT's error codes are stable; its messages may change. */
async function errorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === "string" ? body.error.code : "";
  } catch {
    return "";
  }
}

/** Turn already-cleaned text into MP3 speech in one YarnGPT voice (e.g. "idera"). */
export async function yarngptTextToSpeech(voice: string, text: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/streaming/conversation`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.YARNGPT_API_KEY}`,
      "content-type": "application/json",
      // A fresh key per line: if the connection drops, a retry with the same key is not charged twice.
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ text: text.slice(0, YARNGPT_MAX_CHARACTERS), voice, output_format: "mp3" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.ok) {
    const audio = await res.arrayBuffer();
    // A 200 with almost nothing in it is not usable audio (the docs warn about this).
    if (audio.byteLength < 200) throw new SpeechError("YarnGPT sent back empty audio. Please try again.");
    return audio;
  }
  const code = await errorCode(res);
  if (res.status === 401) throw new SpeechError("YarnGPT did not accept the API key.");
  if (res.status === 402) {
    throw new SpeechError(code === "SUBSCRIPTION_INACTIVE" ? "Your YarnGPT subscription needs attention on your YarnGPT account page." : "Your YarnGPT account has run out of credit.");
  }
  if (res.status === 404 && code === "VOICE_NOT_FOUND") throw new SpeechError("YarnGPT no longer offers this voice. Please choose another one.");
  if (res.status === 429) throw new SpeechError("YarnGPT is busy or today's YarnGPT limit is reached. Please wait a moment and try again.");
  if (res.status === 400 && code === "TEXT_TOO_LONG") throw new SpeechError("That line is too long for YarnGPT. Please use a shorter one.");
  throw new SpeechError(`YarnGPT could not create the speech (${res.status}).`);
}
