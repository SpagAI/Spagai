import "server-only";
import {
  mockAgentReply,
  sanitiseForSpeech,
  type SimMessage,
  type SimTurn,
  type ToolId,
  type Voice,
  type VoiceSettings,
} from "@spagai/core";
import { env } from "../env";
import { RateLimiter } from "../rate-limit";
import { releaseSpeechCharacters, reserveSpeechCharacters, resolveVoice } from "../voices";
import { fishAudioConfigured, fishTextToSpeech, SpeechError } from "./fish-audio";
import { parseChatReply, toChatMessages, toOpenAiTools } from "./openai-format";

/**
 * Provider adapters (M3). Each outside service sits behind a small interface
 * with a free "mock" version. Real ones are switched on in apps/web/.env.
 */

export interface LlmRequest {
  systemPrompt: string;
  /** The whole call so far, ending with the caller's latest line. */
  history: SimMessage[];
  values: Record<string, string>;
  tools: ToolId[];
  now: Date;
}

export interface LlmProvider {
  name: string;
  reply(req: LlmRequest): Promise<SimTurn>;
}

const mockLlm: LlmProvider = {
  name: "mock",
  async reply({ history, values, tools, now }) {
    const last = history.at(-1);
    return mockAgentReply({ callerText: last?.text ?? "", history: history.slice(0, -1), values, tools, now });
  },
};

const openAiCompatibleLlm: LlmProvider = {
  name: "openai_compatible",
  async reply({ systemPrompt, history, tools }) {
    const res = await fetch(`${env.OPENAI_COMPATIBLE_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.OPENAI_COMPATIBLE_API_KEY && { authorization: `Bearer ${env.OPENAI_COMPATIBLE_API_KEY}` }),
      },
      body: JSON.stringify({
        model: env.OPENAI_COMPATIBLE_MODEL,
        messages: toChatMessages(systemPrompt, history),
        tools: toOpenAiTools(tools),
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`The language model returned an error (${res.status}).`);
    return parseChatReply(await res.json(), tools);
  },
};

export function getLlm(): LlmProvider {
  return env.LLM_PROVIDER === "openai_compatible" ? openAiCompatibleLlm : mockLlm;
}

/** How a voice preview is played. */
export type SpeechResult =
  /** Demo voices: the browser speaks the (already cleaned) text with its own voices. */
  | { kind: "browser"; text: string; language: Voice["language"]; gender: Voice["gender"]; providerVoiceId: string; accent: string }
  /** Real provider: an audio file to play. */
  | { kind: "audio"; text: string; src: string }
  | { kind: "error"; message: string };

/** At most 30 real-speech requests per minute per workspace (on top of the daily character limit). */
const speechPerMinute = new RateLimiter(30, 60_000);

/**
 * Every line goes through sanitiseForSpeech before any voice says it.
 * Fish Audio voices are spoken for real (when FISH_AUDIO_API_KEY is set); the built-in demo
 * voices, and any voice whose provider is not connected, use the browser's own speech.
 */
export async function synthesise(organisationId: string, voiceId: string, rawText: string, settings?: VoiceSettings): Promise<SpeechResult> {
  const voice = await resolveVoice(organisationId, voiceId);
  if (!voice) return { kind: "error", message: "Unknown voice." };
  const text = sanitiseForSpeech(rawText).slice(0, 1000);
  if (!text) return { kind: "error", message: "Nothing to say." };
  const browser: SpeechResult = { kind: "browser", text, language: voice.language, gender: voice.gender, providerVoiceId: voice.providerVoiceId, accent: voice.accent };

  if (voice.provider === "fish_audio") {
    if (!fishAudioConfigured()) return browser;
    if (!speechPerMinute.check(organisationId).allowed) return { kind: "error", message: "Too many voice requests. Please wait a minute." };
    if (!(await reserveSpeechCharacters(organisationId, text.length))) {
      return { kind: "error", message: `Today's real-voice allowance for this workspace (${env.VOICE_DAILY_CHAR_LIMIT.toLocaleString("en-NG")} characters) is used up. It resets at midnight, Lagos time.` };
    }
    try {
      const audio = Buffer.from(await fishTextToSpeech(voice.providerVoiceId, text, settings)).toString("base64");
      return { kind: "audio", text, src: `data:audio/mpeg;base64,${audio}` };
    } catch (error) {
      await releaseSpeechCharacters(organisationId, text.length);
      return { kind: "error", message: error instanceof SpeechError ? error.message : "The voice could not be played. Please try again." };
    }
  }

  // Other demo voices (every provider except your own connected server) play with browser speech.
  if (voice.provider !== "openai_compatible") return browser;
  if (voice.status !== "available" || env.TTS_PROVIDER !== voice.provider) {
    return { kind: "error", message: "This voice's provider is not connected yet." };
  }

  const res = await fetch(`${env.OPENAI_COMPATIBLE_BASE_URL!.replace(/\/$/, "")}/audio/speech`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.OPENAI_COMPATIBLE_API_KEY && { authorization: `Bearer ${env.OPENAI_COMPATIBLE_API_KEY}` }),
    },
    body: JSON.stringify({ model: env.OPENAI_COMPATIBLE_TTS_MODEL, voice: voice.providerVoiceId, input: text, response_format: "mp3" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return { kind: "error", message: `The voice provider returned an error (${res.status}).` };
  const audio = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { kind: "audio", text, src: `data:audio/mpeg;base64,${audio}` };
}
