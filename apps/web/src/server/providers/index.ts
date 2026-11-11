import "server-only";
import {
  mockAgentReply,
  sanitiseForSpeech,
  type SimMessage,
  type SimToolCall,
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
  /**
   * Answers a tool call (in the Lab: the simulated tools). When given, a real model that calls a
   * tool gets the result back and then speaks, up to 3 rounds, like on a real call.
   */
  runTool?: (call: SimToolCall) => string;
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

/** Shown when the AI provider's plan limit is reached (e.g. Groq's free plan: 8,000 tokens a minute). */
export class LlmLimitError extends Error {}

async function chatCompletion(messages: unknown[], tools: ToolId[], retried = false): Promise<unknown> {
  const model = env.OPENAI_COMPATIBLE_MODEL!;
  const res = await fetch(`${env.OPENAI_COMPATIBLE_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.OPENAI_COMPATIBLE_API_KEY && { authorization: `Bearer ${env.OPENAI_COMPATIBLE_API_KEY}` }),
    },
    body: JSON.stringify({
      model,
      messages,
      tools: toOpenAiTools(tools),
      temperature: 0.4,
      // Reasoning models (gpt-oss) think before answering; thinking counts towards max_tokens,
      // so allow more room and keep the thinking short for a fast voice reply.
      // Free plans count this room against their per-minute limit, so keep it modest.
      max_tokens: 500,
      ...(/gpt-oss/i.test(model) && { reasoning_effort: "low" }),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) {
    // Free plans allow a few replies a minute. Wait once if the provider says it is only seconds.
    const wait = Number(res.headers.get("retry-after"));
    if (!retried && Number.isFinite(wait) && wait > 0 && wait <= 15) {
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 250));
      return chatCompletion(messages, tools, true);
    }
    throw new LlmLimitError("The AI's free plan limit was reached (a few replies a minute). Wait about 30 seconds and try again, or upgrade the AI plan for faster testing.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Language model error", res.status, detail.slice(0, 300));
    throw new Error(`The language model returned an error (${res.status}).`);
  }
  return res.json();
}

/**
 * Added after every agent's own prompt for real AI models (see docs/DECISIONS.md D125).
 * A phone call is heard, not read, and a made-up price or date can mislead a customer.
 */
export const PHONE_CALL_RULES = `## Phone call rules (always on, these override anything above)
- You are speaking on a live phone call. Reply in one to three short, natural spoken sentences. Plain words only: no tables, lists, markdown, symbols or emojis.
- Facts: you only know what is written in your instructions above. Any price, amount, fee, date, address or policy that is not written there word for word is unknown to you. Never guess or estimate one, even if your instructions say to answer questions about it. Instead say that you do not have that detail with you right now, offer to have someone send it, and continue.
- Ask one question at a time and wait for the answer.`;

const openAiCompatibleLlm: LlmProvider = {
  name: "openai_compatible",
  async reply({ systemPrompt, history, tools, runTool }) {
    const messages: unknown[] = toChatMessages(`${systemPrompt}\n\n${PHONE_CALL_RULES}`, history);
    const allCalls: SimToolCall[] = [];
    for (let round = 0; ; round++) {
      const json = await chatCompletion(messages, tools);
      const turn = parseChatReply(json, tools);
      allCalls.push(...turn.toolCalls);
      const raw = rawToolCalls(json);
      // Done when it spoke, ended the call, used no tool, or after 3 tool rounds.
      if (turn.text || turn.endsCall || !raw.length || !runTool || round >= 2) {
        return { text: turn.text, toolCalls: allCalls, endsCall: allCalls.some((c) => c.tool === "end_call") };
      }
      // Give the model each tool's result, then let it speak.
      messages.push({ role: "assistant", content: null, tool_calls: raw });
      raw.forEach((call, i) => {
        const parsed = turn.toolCalls.find((c) => c.tool === call.function?.name) ?? { tool: call.function?.name as ToolId, args: {} };
        messages.push({ role: "tool", tool_call_id: call.id ?? `call_${round}_${i}`, content: allowedResult(parsed, tools, runTool) });
      });
    }
  },
};

/** The tool calls exactly as the model sent them (with their ids), to send back with the results. */
function rawToolCalls(json: unknown): { id?: string; type?: string; function?: { name?: string; arguments?: string } }[] {
  const calls = (json as { choices?: { message?: { tool_calls?: unknown } }[] })?.choices?.[0]?.message?.tool_calls;
  return Array.isArray(calls) ? calls : [];
}

function allowedResult(call: SimToolCall, tools: ToolId[], runTool: (call: SimToolCall) => string): string {
  return tools.includes(call.tool) ? runTool(call) : "This tool is not available to this agent.";
}

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
