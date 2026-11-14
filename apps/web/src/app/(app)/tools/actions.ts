"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toolInputSchema, webhookUrlProblem } from "@/lib/custom-tools";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { runCustomTool, decryptSecret, encryptSecret, newSigningSecret, toolHeaders, type StoredHeader, type ToolRunResult } from "@/server/custom-tools";
import { db } from "@/server/db";

const MAX_TOOLS = 50;

export type SaveToolResult = { ok: true; id: string } | { ok: false; errors: string[] };

/** Create (id null) or update a tool. Secret header values are encrypted; an empty secret keeps the saved one. */
export async function saveTool(id: string | null, input: unknown): Promise<SaveToolResult> {
  const ctx = await requirePermission("integration:manage");
  const org = ctx.organisation.id;
  const parsed = toolInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const t = parsed.data;
  const urlProblem = webhookUrlProblem(t.url);
  if (urlProblem) return { ok: false, errors: [urlProblem] };
  const bad = t.parameters.find((p) => p.type === "choice" && !p.options?.length);
  if (bad) return { ok: false, errors: [`“${bad.name}” is “One of a list”: add the choices, separated by commas.`] };

  const existing = id ? await db.tool.findFirst({ where: { id, organisationId: org } }) : null;
  if (id && !existing) return { ok: false, errors: ["That tool no longer exists."] };
  const clash = await db.tool.findFirst({ where: { organisationId: org, name: t.name, NOT: id ? { id } : undefined }, select: { id: true } });
  if (clash) return { ok: false, errors: [`You already have a tool called ${t.name}. Choose another name.`] };
  if (!existing && (await db.tool.count({ where: { organisationId: org } })) >= MAX_TOOLS) return { ok: false, errors: [`You can have up to ${MAX_TOOLS} tools.`] };

  const before = existing ? toolHeaders(existing) : [];
  const headers: StoredHeader[] = [];
  for (const h of t.headers) {
    if (!h.secret) { headers.push({ name: h.name, value: h.value, secret: false }); continue; }
    if (h.value) { headers.push({ name: h.name, value: encryptSecret(h.value), secret: true }); continue; }
    const kept = before.find((b) => b.secret && b.name.toLowerCase() === h.name.toLowerCase());
    if (!kept) return { ok: false, errors: [`Enter the secret value for the “${h.name}” header.`] };
    headers.push(kept);
  }

  const data = {
    name: t.name, label: t.label, description: t.description, parameters: t.parameters, url: t.url, method: t.method,
    headers: headers as unknown as object, sendContext: t.sendContext, timeoutMs: t.timeoutMs, waitMessage: t.waitMessage,
  };
  const saved = existing
    ? await db.tool.update({ where: { id: existing.id }, data })
    : await db.tool.create({ data: { ...data, organisationId: org, signingSecret: encryptSecret(newSigningSecret()) } });
  // Agents refer to tools by name: keep them pointing at the renamed tool.
  if (existing && existing.name !== t.name) await renameInAgents(org, existing.name, t.name);
  await audit(org, ctx.user.id, existing ? "tool.updated" : "tool.created", { type: "tool", id: saved.id }, { name: t.name });
  revalidatePath("/tools");
  return { ok: true, id: saved.id };
}

async function renameInAgents(org: string, from: string, to: string) {
  const agents = await db.agent.findMany({ where: { organisationId: org }, select: { id: true, config: true } });
  for (const a of agents) {
    const config = a.config as { customTools?: string[] };
    if (config.customTools?.includes(from)) {
      await db.agent.update({ where: { id: a.id }, data: { config: { ...(a.config as object), customTools: config.customTools.map((n) => (n === from ? to : n)) } } });
    }
  }
}

export async function deleteTool(id: string): Promise<void> {
  const ctx = await requirePermission("integration:manage");
  const org = ctx.organisation.id;
  const tool = await db.tool.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: org } });
  if (!tool) return;
  await db.tool.delete({ where: { id: tool.id } });
  const agents = await db.agent.findMany({ where: { organisationId: org }, select: { id: true, config: true } });
  for (const a of agents) {
    const config = a.config as { customTools?: string[] };
    if (config.customTools?.includes(tool.name)) {
      await db.agent.update({ where: { id: a.id }, data: { config: { ...(a.config as object), customTools: config.customTools.filter((n) => n !== tool.name) } } });
    }
  }
  await audit(org, ctx.user.id, "tool.deleted", { type: "tool", id: tool.id }, { name: tool.name });
  revalidatePath("/tools");
}

/** "Send a test": calls the saved tool with example details, marked test: true. */
export async function sendTestCall(id: string, args: Record<string, unknown>): Promise<ToolRunResult | { error: string }> {
  const ctx = await requirePermission("integration:manage");
  const tool = await db.tool.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!tool) return { error: "Save the tool first." };
  const safeArgs = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).safeParse(args);
  return runCustomTool(tool, safeArgs.success ? safeArgs.data : {}, { agent: { id: "test", name: "Test" }, callId: "test_call", callerPhone: "08030000000", leadName: "Test Person", now: new Date() }, "test");
}

/** The signing secret, so the receiver can check X-Spag-Signature. */
export async function revealSigningSecret(id: string): Promise<{ secret: string } | { error: string }> {
  const ctx = await requirePermission("integration:manage");
  const tool = await db.tool.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!tool) return { error: "That tool no longer exists." };
  try {
    return { secret: decryptSecret(tool.signingSecret) };
  } catch {
    return { error: "The secret could not be read. Create a new one." };
  }
}

export async function rotateSigningSecret(id: string): Promise<{ secret: string } | { error: string }> {
  const ctx = await requirePermission("integration:manage");
  const tool = await db.tool.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!tool) return { error: "That tool no longer exists." };
  const secret = newSigningSecret();
  await db.tool.update({ where: { id: tool.id }, data: { signingSecret: encryptSecret(secret) } });
  await audit(ctx.organisation.id, ctx.user.id, "tool.secret_rotated", { type: "tool", id: tool.id });
  return { secret };
}
