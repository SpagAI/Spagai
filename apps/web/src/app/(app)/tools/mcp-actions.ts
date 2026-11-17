"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { webhookUrlProblem } from "@/lib/custom-tools";
import { fullToolName, hostOf, mcpServerInputSchema, mergeTools, type McpToolInfo } from "@/lib/mcp";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { decryptSecret, encryptSecret } from "@/server/custom-tools";
import { db } from "@/server/db";
import { listMcpTools, McpError, runMcpTool, serverTools, type McpRunResult } from "@/server/mcp-client";

const MAX_SERVERS = 20;

/** What lists of MCP servers show (no secrets). */
export interface McpServerSummary {
  id: string;
  name: string;
  label: string;
  host: string;
  tools: McpToolInfo[];
  lastSyncedAt: string | null;
  lastError: string | null;
}

const summary = (s: { id: string; name: string; label: string; urlHost: string; tools: unknown; lastSyncedAt: Date | null; lastError: string | null }): McpServerSummary => ({
  id: s.id, name: s.name, label: s.label, host: s.urlHost, tools: (s.tools as McpToolInfo[]) ?? [], lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null, lastError: s.lastError,
});

export type SaveMcpResult = { ok: true; server: McpServerSummary } | { ok: false; errors: string[] };

/** Create (id null) or update a server, then connect and read its tools. */
export async function saveMcpServer(id: string | null, input: unknown): Promise<SaveMcpResult> {
  const ctx = await requirePermission("integration:manage");
  const org = ctx.organisation.id;
  const parsed = mcpServerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const m = parsed.data;
  const existing = id ? await db.mcpServer.findFirst({ where: { id, organisationId: org } }) : null;
  if (id && !existing) return { ok: false, errors: ["That server no longer exists."] };
  if (!existing && !m.url) return { ok: false, errors: ["Paste the MCP server address."] };
  if (m.url) {
    const problem = webhookUrlProblem(m.url);
    if (problem) return { ok: false, errors: [problem] };
  }
  const clash = await db.mcpServer.findFirst({ where: { organisationId: org, name: m.name, NOT: id ? { id } : undefined }, select: { id: true } });
  if (clash) return { ok: false, errors: [`You already have a server called ${m.name}. Choose another short name.`] };
  if (!existing && (await db.mcpServer.count({ where: { organisationId: org } })) >= MAX_SERVERS) return { ok: false, errors: [`You can connect up to ${MAX_SERVERS} servers.`] };

  const url = m.url || decryptSecret(existing!.urlEncrypted);
  const auth = m.clearAuth ? "" : m.auth || (existing?.authEncrypted ? decryptSecret(existing.authEncrypted) : "");

  // Connect first, so a wrong address is reported before anything is saved.
  let fresh;
  try {
    fresh = await listMcpTools(url, auth, existing?.timeoutMs ?? 15000);
  } catch (e) {
    return { ok: false, errors: [e instanceof McpError ? e.message : "Could not connect to the MCP server."] };
  }
  const tools = mergeTools(existing ? serverTools(existing) : [], fresh);
  const data = {
    name: m.name, label: m.label, urlEncrypted: encryptSecret(url), urlHost: hostOf(url), authEncrypted: auth ? encryptSecret(auth) : "",
    tools: tools as unknown as object, lastSyncedAt: new Date(), lastError: null,
  };
  const saved = existing ? await db.mcpServer.update({ where: { id: existing.id }, data }) : await db.mcpServer.create({ data: { ...data, organisationId: org } });
  if (existing && existing.name !== m.name) await renameInAgents(org, existing.name, m.name);
  await audit(org, ctx.user.id, existing ? "mcp.updated" : "mcp.connected", { type: "mcpServer", id: saved.id }, { name: m.name, tools: tools.length });
  revalidatePath("/tools");
  return { ok: true, server: summary(saved) };
}

/** Read the tool list again (e.g. after adding scenarios in Make). */
export async function refreshMcpServer(id: string): Promise<SaveMcpResult> {
  const ctx = await requirePermission("integration:manage");
  const server = await db.mcpServer.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!server) return { ok: false, errors: ["That server no longer exists."] };
  try {
    const fresh = await listMcpTools(decryptSecret(server.urlEncrypted), server.authEncrypted ? decryptSecret(server.authEncrypted) : "", server.timeoutMs);
    const saved = await db.mcpServer.update({ where: { id: server.id }, data: { tools: mergeTools(serverTools(server), fresh) as unknown as object, lastSyncedAt: new Date(), lastError: null } });
    revalidatePath("/tools");
    return { ok: true, server: summary(saved) };
  } catch (e) {
    const message = e instanceof McpError ? e.message : "Could not connect to the MCP server.";
    await db.mcpServer.update({ where: { id: server.id }, data: { lastError: message } });
    return { ok: false, errors: [message] };
  }
}

/** Choose which of a server's tools agents may use. */
export async function setMcpToolAllowed(id: string, toolName: string, allowed: boolean): Promise<SaveMcpResult> {
  const ctx = await requirePermission("integration:manage");
  const server = await db.mcpServer.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!server) return { ok: false, errors: ["That server no longer exists."] };
  const tools = serverTools(server).map((t) => (t.name === toolName ? { ...t, allowed } : t));
  const saved = await db.mcpServer.update({ where: { id: server.id }, data: { tools: tools as unknown as object } });
  if (!allowed) await removeFromAgents(ctx.organisation.id, (n) => n === fullToolName(server.name, toolName));
  revalidatePath("/tools");
  return { ok: true, server: summary(saved) };
}

export async function testMcpTool(id: string, toolName: string, args: Record<string, unknown>): Promise<McpRunResult | { error: string }> {
  const ctx = await requirePermission("integration:manage");
  const server = await db.mcpServer.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!server) return { error: "That server no longer exists." };
  const safeArgs = z.record(z.string(), z.unknown()).safeParse(args);
  return runMcpTool(server, toolName, safeArgs.success ? safeArgs.data : {}, "test");
}

export async function deleteMcpServer(id: string): Promise<void> {
  const ctx = await requirePermission("integration:manage");
  const server = await db.mcpServer.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!server) return;
  await db.mcpServer.delete({ where: { id: server.id } });
  await removeFromAgents(ctx.organisation.id, (n) => n.startsWith(`${server.name}__`));
  await audit(ctx.organisation.id, ctx.user.id, "mcp.deleted", { type: "mcpServer", id: server.id }, { name: server.name });
  revalidatePath("/tools");
}

/** Recent runs of a server's tools, for its page. */
export async function listMcpRuns(id: string) {
  const ctx = await requirePermission("integration:manage");
  const runs = await db.mcpRun.findMany({ where: { serverId: z.string().min(1).parse(id), organisationId: ctx.organisation.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return runs.map((r) => ({ id: r.id, toolName: r.toolName, source: r.source, ok: r.ok, response: r.response, durationMs: r.durationMs, request: r.request, createdAt: r.createdAt.toISOString() }));
}

async function removeFromAgents(org: string, match: (name: string) => boolean) {
  const agents = await db.agent.findMany({ where: { organisationId: org }, select: { id: true, config: true } });
  for (const a of agents) {
    const names = (a.config as { mcpTools?: string[] }).mcpTools ?? [];
    if (names.some(match)) await db.agent.update({ where: { id: a.id }, data: { config: { ...(a.config as object), mcpTools: names.filter((n) => !match(n)) } } });
  }
}

async function renameInAgents(org: string, from: string, to: string) {
  const agents = await db.agent.findMany({ where: { organisationId: org }, select: { id: true, config: true } });
  for (const a of agents) {
    const names = (a.config as { mcpTools?: string[] }).mcpTools ?? [];
    if (names.some((n) => n.startsWith(`${from}__`))) {
      await db.agent.update({ where: { id: a.id }, data: { config: { ...(a.config as object), mcpTools: names.map((n) => (n.startsWith(`${from}__`) ? `${to}__${n.slice(from.length + 2)}` : n)) } } });
    }
  }
}
