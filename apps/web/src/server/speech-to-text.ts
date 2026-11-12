import "server-only";
import { env } from "./env";
import { RateLimiter } from "./rate-limit";

/**
 * Speech to text on our side (not the visitor's browser), so listening is equally sharp on any
 * device. Uses the OpenAI-compatible provider's /audio/transcriptions (Groq Whisper).
 */
export function speechToTextAvailable(): boolean {
  return env.LLM_PROVIDER === "openai_compatible" && Boolean(env.OPENAI_COMPATIBLE_BASE_URL);
}

/** Words Whisper often gets wrong in Nigerian calls. Agent-specific words are added per call. */
const NIGERIAN_WORDS = ["abeg", "wahala", "naira", "kobo", "oga", "madam", "sha", "abi", "Lagos", "Lekki", "Ikeja", "Victoria Island", "Ajah", "Yaba", "Surulere", "Abuja", "Port Harcourt", "Ibadan", "BVN", "NIN", "POS"];

/** A short hint for Whisper (it reads about the first 200 words), built from the agent's own names. */
export function whisperHint(words: string[]): string {
  const unique = [...new Set([...words.map((w) => w.trim()).filter((w) => w && w.length <= 60), ...NIGERIAN_WORDS])];
  let hint = "Nigerian English phone call. Words: ";
  for (const w of unique) {
    if ((hint + w).length > 700) break;
    hint += `${w}, `;
  }
  return hint.replace(/, $/, ".");
}

/** At most 60 clips a minute per workspace (the free Groq plan allows 2 hours of audio per hour). */
const clipsPerMinute = new RateLimiter(60, 60_000);

export class SpeechToTextError extends Error {}

export async function transcribe(organisationId: string, audio: Blob, hintWords: string[], language: string): Promise<string> {
  if (!speechToTextAvailable()) throw new SpeechToTextError("Listening on the server is not set up.");
  if (!clipsPerMinute.check(organisationId).allowed) throw new SpeechToTextError("Too many recordings. Please wait a minute.");
  const form = new FormData();
  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  form.append("file", audio, `speech.${ext}`);
  form.append("model", env.STT_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  // Nigerian English and Pidgin are transcribed as English; Yoruba, Hausa and Igbo are left to Whisper to detect.
  if (language === "en-NG" || language === "pcm") form.append("language", "en");
  form.append("prompt", whisperHint(hintWords));
  const res = await fetch(`${env.OPENAI_COMPATIBLE_BASE_URL!.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: env.OPENAI_COMPATIBLE_API_KEY ? { authorization: `Bearer ${env.OPENAI_COMPATIBLE_API_KEY}` } : {},
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) throw new SpeechToTextError("The free listening limit was reached. Wait a minute and try again.");
  if (!res.ok) {
    console.error("Speech to text error", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new SpeechToTextError("The recording could not be understood. Please try again.");
  }
  const json = (await res.json()) as { text?: unknown };
  return typeof json.text === "string" ? json.text.trim() : "";
}
