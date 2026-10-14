/**
 * Pure helpers for OpenAI-compatible chat APIs (OpenAI, Groq, Together, a local
 * Ollama or vLLM server, ...). No network here, so it is easy to test.
 */

import { TOOL_DEFINITIONS, type SimMessage, type SimToolCall, type SimTurn, type ToolId } from "@spagai/core";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** The agent's tools in the OpenAI "function calling" format. */
export function toOpenAiTools(tools: ToolId[]) {
  return tools.map((id) => {
    const def = TOOL_DEFINITIONS[id];
    return {
      type: "function" as const,
      function: {
        name: def.id,
        description: def.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(def.parameters).map(([name, p]) => [
              name,
              { type: p.type, description: p.description, ...(p.enum && { enum: p.enum }), ...(p.pattern && { pattern: p.pattern }) },
            ]),
          ),
          required: def.required,
        },
      },
    };
  });
}

/** System prompt, then the call so far. The agent is "assistant", the caller is "user". */
export function toChatMessages(systemPrompt: string, history: SimMessage[]): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...history.map((m): ChatMessage => ({ role: m.role === "agent" ? "assistant" : "user", content: m.text })),
  ];
}

interface RawToolCall {
  function?: { name?: string; arguments?: string };
}

/** Read the model's reply. Unknown tools and broken arguments are dropped, not trusted. */
export function parseChatReply(json: unknown, allowed: ToolId[]): SimTurn {
  const message = (json as { choices?: { message?: { content?: string | null; tool_calls?: RawToolCall[] } }[] })?.choices?.[0]?.message;
  if (!message) throw new Error("The language model returned no reply.");
  const toolCalls: SimToolCall[] = [];
  for (const call of message.tool_calls ?? []) {
    const name = call.function?.name as ToolId | undefined;
    if (!name || !allowed.includes(name)) continue;
    let args: Record<string, string | boolean> = {};
    try {
      const parsed: unknown = JSON.parse(call.function?.arguments || "{}");
      if (parsed && typeof parsed === "object") {
        args = Object.fromEntries(
          Object.entries(parsed).filter((e): e is [string, string | boolean] => typeof e[1] === "string" || typeof e[1] === "boolean"),
        );
      }
    } catch {
      // Keep the call with no arguments; the simulator will show it as failed.
    }
    toolCalls.push({ tool: name, args });
  }
  return {
    text: (message.content ?? "").trim(),
    toolCalls,
    endsCall: toolCalls.some((c) => c.tool === "end_call"),
  };
}
