"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge";
import { audit } from "@/server/agents";
import { requireOrg, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { KnowledgeError, readWebsite, storeContent } from "@/server/knowledge";

/** What the knowledge screens show for each item. */
export interface KnowledgeRow {
  id: string;
  kind: "FILE" | "WEBSITE" | "TEXT";
  name: string;
  url: string;
  sizeBytes: number;
  pages: number;
  chunks: number;
  contentChars: number;
  status: "PROCESSING" | "READY" | "FAILED";
  error: string | null;
  createdAt: string;
}

export type KnowledgeResult = { ok: true; items: KnowledgeRow[]; message: string } | { ok: false; error: string };

const FILE_TYPES = /\.(pdf|docx|txt|md|markdown|csv)$/i;

async function agentInOrg(organisationId: string, agentId: unknown) {
  const id = typeof agentId === "string" ? agentId : "";
  return id ? db.agent.findFirst({ where: { id, organisationId }, select: { id: true, name: true } }) : null;
}

async function rows(agentId: string): Promise<KnowledgeRow[]> {
  const items = await db.knowledgeItem.findMany({ where: { agentId }, orderBy: { createdAt: "desc" } });
  return items.map((i) => ({
    id: i.id, kind: i.kind, name: i.name, url: i.url, sizeBytes: i.sizeBytes, pages: i.pages, chunks: i.chunks, contentChars: i.contentChars,
    status: i.status, error: i.error, createdAt: i.createdAt.toISOString(),
  }));
}

function changed(agentId: string) {
  revalidatePath("/knowledge");
  revalidatePath(`/agents/${agentId}`);
}

export async function listKnowledge(agentId: string): Promise<KnowledgeRow[]> {
  const ctx = await requireOrg();
  const agent = await agentInOrg(ctx.organisation.id, agentId);
  return agent ? rows(agent.id) : [];
}

/** Written or pasted text, e.g. prices, opening hours or FAQs. */
export async function addKnowledgeText(agentId: string, title: string, text: string): Promise<KnowledgeResult> {
  const ctx = await requirePermission("knowledge:edit");
  const agent = await agentInOrg(ctx.organisation.id, agentId);
  if (!agent) return { ok: false, error: "That agent no longer exists." };
  const name = z.string().trim().min(1).max(120).safeParse(title);
  if (!name.success) return { ok: false, error: "Give it a short title, e.g. Price list." };
  if (text.trim().length < 10) return { ok: false, error: "Write or paste some text first." };
  if (text.length > KNOWLEDGE_LIMITS.itemChars) return { ok: false, error: `That is longer than ${KNOWLEDGE_LIMITS.itemChars.toLocaleString("en")} characters. Split it into parts.` };
  const item = await db.knowledgeItem.create({ data: { organisationId: ctx.organisation.id, agentId: agent.id, kind: "TEXT", name: name.data, sizeBytes: new TextEncoder().encode(text).length, status: "PROCESSING", createdById: ctx.user.id } });
  try {
    const r = await storeContent(item, text);
    await audit(ctx.organisation.id, ctx.user.id, "knowledge.text_added", { type: "knowledgeItem", id: item.id }, { chars: r.chars });
    changed(agent.id);
    return { ok: true, items: await rows(agent.id), message: `“${name.data}” added (${r.pieces} searchable piece${r.pieces === 1 ? "" : "s"}).` };
  } catch (e) {
    await db.knowledgeItem.delete({ where: { id: item.id } });
    return { ok: false, error: e instanceof KnowledgeError ? e.message : "Could not save that text." };
  }
}

/** Files whose text was read in the browser (PDF, Word, text, Markdown, CSV). */
export async function addKnowledgeFiles(agentId: string, files: { name: string; size: number; type: string; text: string }[]): Promise<KnowledgeResult> {
  const ctx = await requirePermission("knowledge:edit");
  const agent = await agentInOrg(ctx.organisation.id, agentId);
  if (!agent) return { ok: false, error: "That agent no longer exists." };
  const parsed = z.array(z.object({ name: z.string().min(1).max(200), size: z.number().int().min(0).max(50 * 1024 * 1024), type: z.string().max(120), text: z.string().max(KNOWLEDGE_LIMITS.itemChars * 2) })).min(1).max(10).safeParse(files);
  if (!parsed.success) return { ok: false, error: "Choose up to 10 files." };
  const bad = parsed.data.find((f) => !FILE_TYPES.test(f.name));
  if (bad) return { ok: false, error: `${bad.name}: use PDF, Word (.docx), text, Markdown or CSV files.` };
  const added: string[] = [];
  const problems: string[] = [];
  for (const f of parsed.data) {
    const item = await db.knowledgeItem.create({ data: { organisationId: ctx.organisation.id, agentId: agent.id, kind: "FILE", name: f.name, sizeBytes: f.size, mimeType: f.type, status: "PROCESSING", createdById: ctx.user.id } });
    try {
      await storeContent(item, f.text);
      added.push(f.name);
    } catch (e) {
      const why = e instanceof KnowledgeError ? e.message : "Could not read it.";
      await db.knowledgeItem.update({ where: { id: item.id }, data: { status: "FAILED", error: why } });
      problems.push(`${f.name}: ${why}`);
    }
  }
  if (added.length) await audit(ctx.organisation.id, ctx.user.id, "knowledge.files_added", { type: "agent", id: agent.id }, { files: added });
  changed(agent.id);
  return { ok: true, items: await rows(agent.id), message: [added.length ? `${added.length} file${added.length === 1 ? "" : "s"} added.` : "", ...problems].filter(Boolean).join(" ") };
}

/** One web page, or several pages of the same site, read now from our server. */
export async function addKnowledgeWebsite(agentId: string, rawUrl: string, wholeSite: boolean): Promise<KnowledgeResult> {
  const ctx = await requirePermission("knowledge:edit");
  const agent = await agentInOrg(ctx.organisation.id, agentId);
  if (!agent) return { ok: false, error: "That agent no longer exists." };
  let url: URL;
  try {
    const raw = rawUrl.trim();
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) throw new Error();
  } catch {
    return { ok: false, error: "Enter a website address, e.g. https://mybusiness.com." };
  }
  const name = url.hostname.replace(/^www\./, "") + (wholeSite ? "" : url.pathname.replace(/\/$/, ""));
  const item = await db.knowledgeItem.create({ data: { organisationId: ctx.organisation.id, agentId: agent.id, kind: "WEBSITE", name, url: url.toString(), status: "PROCESSING", createdById: ctx.user.id } });
  try {
    const site = await readWebsite(url.toString(), wholeSite);
    const r = await storeContent(item, site.text, { pages: site.pages });
    await audit(ctx.organisation.id, ctx.user.id, "knowledge.website_added", { type: "knowledgeItem", id: item.id }, { url: url.toString(), pages: site.pages });
    changed(agent.id);
    return { ok: true, items: await rows(agent.id), message: `Read ${site.pages} page${site.pages === 1 ? "" : "s"} from ${url.hostname} (${r.pieces} searchable pieces).` };
  } catch (e) {
    const why = e instanceof KnowledgeError ? e.message : "That website could not be read.";
    await db.knowledgeItem.delete({ where: { id: item.id } });
    return { ok: false, error: why };
  }
}

export async function deleteKnowledgeItem(id: string): Promise<KnowledgeResult> {
  const ctx = await requirePermission("knowledge:edit");
  const item = await db.knowledgeItem.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id } });
  if (!item) return { ok: false, error: "That item no longer exists." };
  await db.knowledgeItem.delete({ where: { id: item.id } });
  await audit(ctx.organisation.id, ctx.user.id, "knowledge.deleted", { type: "knowledgeItem", id: item.id });
  changed(item.agentId);
  return { ok: true, items: await rows(item.agentId), message: `“${item.name}” removed.` };
}

/** The stored text of an item (first part), to check what the agent will know. */
export async function previewKnowledge(id: string): Promise<{ text: string; more: boolean } | { error: string }> {
  const ctx = await requireOrg();
  const item = await db.knowledgeItem.findFirst({ where: { id: z.string().min(1).parse(id), organisationId: ctx.organisation.id }, select: { id: true, chunks: true } });
  if (!item) return { error: "That item no longer exists." };
  const pieces = await db.knowledgeChunk.findMany({ where: { itemId: item.id }, orderBy: { position: "asc" }, take: 4, select: { text: true } });
  return { text: pieces.map((p) => p.text).join("\n\n"), more: item.chunks > pieces.length };
}
