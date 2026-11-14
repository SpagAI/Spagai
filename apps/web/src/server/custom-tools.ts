import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { Tool } from "@prisma/client";
import { buildRequest, cleanArguments, toJsonSchema, webhookUrlProblem, type ContextKey, type ToolContext, type ToolParam } from "@/lib/custom-tools";
import { db } from "./db";
import { env } from "./env";
import { RateLimiter } from "./rate-limit";

/**
 * Runs a workspace's own tools: calls its webhook from our server (never from the browser),
 * with a time limit, a size limit on the reply, a signature the receiver can check, and a log.
 */

const MAX_RESPONSE = 50_000;
const KEEP_RUNS = 50;
/** At most 30 webhook calls a minute per workspace. */
const callsPerMinute = new RateLimiter(30, 60_000);

const aesKey = () => createHash("sha256").update(`tool-secrets:${env.SESSION_SECRET}`).digest();

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Malformed secret.");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function newSigningSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** X-Spag-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>"> */
export function signature(secret: string, body: string, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

export interface StoredHeader { name: string; value: string; secret: boolean }

export const toolParams = (tool: Pick<Tool, "parameters">) => (tool.parameters as unknown as ToolParam[]) ?? [];
export const toolHeaders = (tool: Pick<Tool, "headers">) => (tool.headers as unknown as StoredHeader[]) ?? [];

/** What the AI is told about a tool (OpenAI "function" format). */
export function functionSpec(tool: Pick<Tool, "name" | "description" | "parameters">) {
  return { type: "function" as const, function: { name: tool.name, description: tool.description, parameters: toJsonSchema(toolParams(tool)) } };
}

export interface ToolRunResult {
  ok: boolean;
  status: number | null;
  /** The reply (shortened), or a plain explanation of what went wrong. */
  response: string;
  durationMs: number;
  error?: string;
  request: { url: string; method: string; headers: Record<string, string>; body: unknown };
}

/** The tools an agent has switched on, in this workspace. */
export async function toolsForAgent(organisationId: string, names: string[]): Promise<Tool[]> {
  if (!names.length) return [];
  return db.tool.findMany({ where: { organisationId, name: { in: names } } });
}

/** Call the tool's webhook. Never throws: failures come back as a result the AI can explain. */
export async function runCustomTool(
  tool: Tool,
  args: Record<string, unknown>,
  context: ToolContext,
  source: "test" | "talk" | "call",
): Promise<ToolRunResult> {
  const started = Date.now();
  const { values, missing } = cleanArguments(toolParams(tool), args);
  const req = buildRequest({ name: tool.name, url: tool.url, method: tool.method, sendContext: tool.sendContext as unknown as Record<ContextKey, boolean> }, values, context, source === "test");

  const shownHeaders: Record<string, string> = { "content-type": "application/json", "user-agent": "SpagAI-Tools/1.0" };
  const realHeaders: Record<string, string> = { ...shownHeaders };
  for (const h of toolHeaders(tool)) {
    let value = h.value;
    if (h.secret) {
      try { value = decryptSecret(h.value); } catch { value = ""; }
    }
    realHeaders[h.name.toLowerCase()] = value;
    shownHeaders[h.name.toLowerCase()] = h.secret ? "•••• (hidden)" : value;
  }
  let secret = "";
  try { secret = decryptSecret(tool.signingSecret); } catch { /* re-saved tools get a new one */ }
  const sig = signature(secret, req.body ?? req.url);
  realHeaders["x-spag-signature"] = sig;
  shownHeaders["x-spag-signature"] = sig;
  if (!req.body) {
    delete realHeaders["content-type"];
    delete shownHeaders["content-type"];
  }
  const request = { url: req.url, method: req.method, headers: shownHeaders, body: req.body ? req.payload : null };

  const finish = async (r: Omit<ToolRunResult, "durationMs" | "request">): Promise<ToolRunResult> => {
    const result = { ...r, durationMs: Date.now() - started, request };
    await logRun(tool, context.agent?.id ?? null, source, result).catch((e) => console.error("Tool run log failed", e));
    return result;
  };

  if (missing.length) return finish({ ok: false, status: null, response: `Not sent: these details are still needed: ${missing.join(", ")}.`, error: "missing_details" });
  const problem = webhookUrlProblem(tool.url);
  if (problem) return finish({ ok: false, status: null, response: problem, error: "bad_url" });
  if (!callsPerMinute.check(tool.organisationId).allowed) return finish({ ok: false, status: null, response: "Too many tool calls this minute. Please wait a moment.", error: "rate_limited" });

  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: realHeaders,
      body: req.body ?? undefined,
      // Never follow a redirect: it could point somewhere private.
      redirect: "manual",
      signal: AbortSignal.timeout(Math.min(20_000, Math.max(1000, tool.timeoutMs))),
    });
    const text = await readLimited(res);
    if (res.status >= 300 && res.status < 400) return finish({ ok: false, status: res.status, response: "The webhook tried to redirect to another address. Use the final address instead.", error: "redirect" });
    return finish({ ok: res.ok, status: res.status, response: text || (res.ok ? "Done." : `The webhook answered with an error (${res.status}).`), error: res.ok ? undefined : "http_error" });
  } catch (e) {
    const timeout = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
    return finish({ ok: false, status: null, response: timeout ? `The webhook did not answer within ${Math.round(tool.timeoutMs / 1000)} seconds.` : "The webhook could not be reached.", error: timeout ? "timeout" : "network" });
  }
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (out.length < MAX_RESPONSE) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return out.length > MAX_RESPONSE ? `${out.slice(0, MAX_RESPONSE)}… (shortened)` : out;
}

async function logRun(tool: Tool, agentId: string | null, source: string, r: ToolRunResult) {
  await db.toolRun.create({
    data: { toolId: tool.id, organisationId: tool.organisationId, agentId, source, request: r.request as object, status: r.status, ok: r.ok, response: r.response.slice(0, 5000), durationMs: r.durationMs, error: r.error ?? null },
  });
  const old = await db.toolRun.findMany({ where: { toolId: tool.id }, orderBy: { createdAt: "desc" }, skip: KEEP_RUNS, select: { id: true } });
  if (old.length) await db.toolRun.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

/** Short text the AI reads back after a tool ran. */
export function resultForAi(r: ToolRunResult): string {
  const body = r.response.length > 2000 ? `${r.response.slice(0, 2000)}…` : r.response;
  return r.ok ? `Success. Reply from the system: ${body}` : `Failed. ${body} Tell the person you could not complete this right now and a colleague will follow up.`;
}
