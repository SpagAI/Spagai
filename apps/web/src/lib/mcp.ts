/**
 * MCP (Model Context Protocol) helpers: connecting a workspace to an MCP server such as Make.com's,
 * whose tools agents can then use during calls. Pure (no network), so it can be tested.
 * Sending happens in src/server/mcp-client.ts.
 */
import { z } from "zod";

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Whether agents in this workspace may switch it on. */
  allowed: boolean;
}

const slugRe = /^[a-z][a-z0-9_]{1,19}$/;

export const mcpServerInputSchema = z.object({
  label: z.string().trim().min(1, "Give the server a name, e.g. Make.").max(60),
  name: z.string().regex(slugRe, "The short name uses lowercase letters, numbers and underscores, e.g. make."),
  /** "" when editing means "keep the saved address". */
  url: z.string().trim().max(2000),
  /** Optional Authorization header value; "" keeps the saved one when editing. */
  auth: z.string().max(2000),
  clearAuth: z.boolean().default(false),
});
export type McpServerInput = z.infer<typeof mcpServerInputSchema>;

/** The tool name the AI sees: "make" + "Book appointment" -> "make__book_appointment" (max 64 characters). */
export function fullToolName(serverName: string, toolName: string): string {
  const tool = toolName.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "tool";
  return `${serverName}__${tool}`.slice(0, 64);
}

/** Split "make__book_appointment" back into the server's short name. */
export function serverOf(fullName: string): string {
  return fullName.split("__")[0] ?? "";
}

/** A tool's input schema in the shape the AI accepts (always an object with properties). */
export function safeSchema(schema: unknown): Record<string, unknown> {
  const s = schema && typeof schema === "object" ? (schema as Record<string, unknown>) : {};
  return { ...s, type: "object", properties: s.properties && typeof s.properties === "object" ? s.properties : {} };
}

interface JsonRpcMessage { jsonrpc?: string; id?: string | number | null; result?: unknown; error?: { code?: number; message?: string } }

/**
 * Read a JSON-RPC reply. MCP servers answer either with plain JSON or with a short event stream
 * ("event: message / data: {...}"); this handles both and returns the message with the given id.
 */
export function readRpcReply(body: string, contentType: string, id: number): JsonRpcMessage | null {
  const messages: JsonRpcMessage[] = [];
  if (contentType.includes("text/event-stream")) {
    for (const block of body.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      try { messages.push(JSON.parse(data) as JsonRpcMessage); } catch { /* not JSON: skip */ }
    }
  } else {
    try {
      const parsed = JSON.parse(body) as JsonRpcMessage | JsonRpcMessage[];
      messages.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      return null;
    }
  }
  return messages.find((m) => m.id === id) ?? null;
}

/** The tool list from a tools/list result. */
export function parseToolList(result: unknown): Omit<McpToolInfo, "allowed">[] {
  const tools = (result as { tools?: unknown })?.tools;
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((t): t is { name: string; description?: unknown; inputSchema?: unknown } => !!t && typeof (t as { name?: unknown }).name === "string")
    .map((t) => ({ name: t.name, description: typeof t.description === "string" ? t.description.slice(0, 1000) : "", inputSchema: safeSchema(t.inputSchema) }));
}

/** A tools/call result as plain text for the AI (text parts joined; other parts summarised). */
export function toolResultText(result: unknown): { text: string; isError: boolean } {
  const r = (result ?? {}) as { content?: unknown; structuredContent?: unknown; isError?: unknown };
  const parts: string[] = [];
  if (Array.isArray(r.content)) {
    for (const c of r.content as { type?: string; text?: string; resource?: { text?: string } }[]) {
      if (c?.type === "text" && typeof c.text === "string") parts.push(c.text);
      else if (c?.type === "resource" && typeof c.resource?.text === "string") parts.push(c.resource.text);
      else if (c?.type) parts.push(`[${c.type}]`);
    }
  }
  if (!parts.length && r.structuredContent) parts.push(JSON.stringify(r.structuredContent));
  return { text: parts.join("\n").trim() || "Done.", isError: r.isError === true };
}

/** Keep the "allowed" choices when a server's tool list is read again. */
export function mergeTools(previous: McpToolInfo[], fresh: Omit<McpToolInfo, "allowed">[]): McpToolInfo[] {
  return fresh.map((t) => ({ ...t, allowed: previous.find((p) => p.name === t.name)?.allowed ?? true }));
}

/** Shown instead of the secret address. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
