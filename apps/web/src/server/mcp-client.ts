import "server-only";
import type { McpServer } from "@prisma/client";
import { webhookUrlProblem } from "@/lib/custom-tools";
import { fullToolName, parseToolList, readRpcReply, safeSchema, toolResultText, type McpToolInfo } from "@/lib/mcp";
import { decryptSecret } from "./custom-tools";
import { db } from "./db";
import { RateLimiter } from "./rate-limit";

/**
 * Talks to remote MCP servers (Streamable HTTP, as Make.com's "stateless" address uses) from our
 * server only: same safety as webhooks (public https only, no redirects, time and size limits).
 */

const PROTOCOL = "2025-06-18";
const MAX_BODY = 200_000;
const KEEP_RUNS = 50;
const callsPerMinute = new RateLimiter(30, 60_000);

export class McpError extends Error {}

interface Conn { url: string; auth: string; timeoutMs: number; session?: string }

function secretsOf(server: Pick<McpServer, "urlEncrypted" | "authEncrypted" | "timeoutMs">): Conn {
  return { url: decryptSecret(server.urlEncrypted), auth: server.authEncrypted ? decryptSecret(server.authEncrypted) : "", timeoutMs: server.timeoutMs };
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (out.length < MAX_BODY) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return out;
}

let nextId = 1;

async function send(conn: Conn, method: string, params: unknown, notify = false): Promise<unknown> {
  const problem = webhookUrlProblem(conn.url);
  if (problem) throw new McpError(problem);
  const id = nextId++;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL,
    "user-agent": "SpagAI-Studio/1.0",
  };
  if (conn.auth) headers.authorization = conn.auth;
  if (conn.session) headers["mcp-session-id"] = conn.session;
  let res: Response;
  try {
    res = await fetch(conn.url, {
      method: "POST",
      headers,
      body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params }),
      redirect: "manual",
      signal: AbortSignal.timeout(conn.timeoutMs),
    });
  } catch (e) {
    const timeout = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
    throw new McpError(timeout ? `The MCP server did not answer within ${Math.round(conn.timeoutMs / 1000)} seconds.` : "The MCP server could not be reached. Check the address.");
  }
  const session = res.headers.get("mcp-session-id");
  if (session) conn.session = session;
  if (notify) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  if (res.status >= 300 && res.status < 400) throw new McpError("The MCP server tried to redirect. Use its final address.");
  if (res.status === 401 || res.status === 403) throw new McpError("The MCP server refused the connection (not authorised). Check the address or access key.");
  const body = await readLimited(res);
  if (!res.ok) throw new McpError(`The MCP server answered with an error (${res.status}). ${body.slice(0, 200)}`.trim());
  const reply = readRpcReply(body, res.headers.get("content-type") ?? "", id);
  if (!reply) throw new McpError("The MCP server's answer could not be read. Check that this is an MCP server address.");
  if (reply.error) throw new McpError(`The MCP server said: ${reply.error.message ?? "error"}.`);
  return reply.result;
}

async function open(conn: Conn) {
  await send(conn, "initialize", { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "Spag AI Studio", version: "1.0" } });
  await send(conn, "notifications/initialized", {}, true);
}

/** Connect and read every tool the server offers (up to 5 pages). */
export async function listMcpTools(url: string, auth: string, timeoutMs = 15000): Promise<Omit<McpToolInfo, "allowed">[]> {
  const conn: Conn = { url, auth, timeoutMs };
  await open(conn);
  const tools: Omit<McpToolInfo, "allowed">[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result = (await send(conn, "tools/list", cursor ? { cursor } : {})) as { nextCursor?: string };
    tools.push(...parseToolList(result));
    cursor = typeof result?.nextCursor === "string" && result.nextCursor ? result.nextCursor : undefined;
    if (!cursor) break;
  }
  return tools;
}

export const serverTools = (server: Pick<McpServer, "tools">) => (server.tools as unknown as McpToolInfo[]) ?? [];

export interface McpRunResult { ok: boolean; response: string; durationMs: number; request: { tool: string; arguments: unknown } }

/** Run one tool. Never throws: problems come back as a result the AI can explain. */
export async function runMcpTool(server: McpServer, toolName: string, args: Record<string, unknown>, source: "test" | "talk" | "call", agentId?: string): Promise<McpRunResult> {
  const started = Date.now();
  const request = { tool: toolName, arguments: args };
  const finish = async (ok: boolean, response: string, error?: string): Promise<McpRunResult> => {
    const r = { ok, response: response.slice(0, 50_000), durationMs: Date.now() - started, request };
    try {
      await db.mcpRun.create({ data: { serverId: server.id, organisationId: server.organisationId, toolName, source, request: request as object, ok, response: r.response.slice(0, 5000), durationMs: r.durationMs, error: error ?? null } });
      const old = await db.mcpRun.findMany({ where: { serverId: server.id }, orderBy: { createdAt: "desc" }, skip: KEEP_RUNS, select: { id: true } });
      if (old.length) await db.mcpRun.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    } catch (e) {
      console.error("MCP run log failed", e, agentId);
    }
    return r;
  };
  if (!serverTools(server).some((t) => t.name === toolName && t.allowed)) return finish(false, "This tool is not available.", "not_allowed");
  if (!callsPerMinute.check(server.organisationId).allowed) return finish(false, "Too many tool calls this minute. Please wait a moment.", "rate_limited");
  try {
    const conn = secretsOf(server);
    await open(conn);
    const result = await send(conn, "tools/call", { name: toolName, arguments: args });
    const { text, isError } = toolResultText(result);
    return finish(!isError, text, isError ? "tool_error" : undefined);
  } catch (e) {
    return finish(false, e instanceof McpError ? e.message : "The MCP tool could not be run.", "error");
  }
}

/** The MCP tools an agent has switched on, as functions for the AI plus a way to find each again. */
export async function mcpToolsForAgent(organisationId: string, names: string[]) {
  if (!names.length) return [];
  const servers = await db.mcpServer.findMany({ where: { organisationId } });
  const out: { fullName: string; server: McpServer; tool: McpToolInfo; spec: { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } } }[] = [];
  for (const server of servers) {
    for (const tool of serverTools(server)) {
      const fullName = fullToolName(server.name, tool.name);
      if (!tool.allowed || !names.includes(fullName)) continue;
      out.push({ fullName, server, tool, spec: { type: "function", function: { name: fullName, description: `${tool.description || tool.name} (via ${server.label})`.slice(0, 1000), parameters: safeSchema(tool.inputSchema) } } });
    }
  }
  return out;
}
