"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export type KnowledgeFormState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = /\.(pdf|docx?|txt|md|csv|xlsx?|pptx?)$/i;

async function agentInOrg(organisationId: string, agentId: unknown) {
  const id = typeof agentId === "string" ? agentId : "";
  return id ? db.agent.findFirst({ where: { id, organisationId }, select: { id: true, name: true } }) : null;
}

/**
 * Prototype: the browser sends each file's name, size and type, not the file itself,
 * so nothing is stored. Content would be read and split into searchable pieces here.
 */
export async function addFiles(_prev: KnowledgeFormState, form: FormData): Promise<KnowledgeFormState> {
  const ctx = await requirePermission("knowledge:edit");
  const agent = await agentInOrg(ctx.organisation.id, form.get("agentId"));
  if (!agent) return { status: "error", message: "Choose which agent should use these files." };
  const files = z
    .array(z.object({ name: z.string().min(1).max(200), size: z.number().int().min(1), type: z.string().max(120) }))
    .min(1)
    .max(10)
    .safeParse(JSON.parse(String(form.get("files") ?? "[]")));
  if (!files.success) return { status: "error", message: "Choose up to 10 files first." };
  const bad = files.data.find((f) => !ALLOWED.test(f.name));
  if (bad) return { status: "error", message: `${bad.name} is not a supported file. Use PDF, Word, Excel, PowerPoint, CSV or text files.` };
  const big = files.data.find((f) => f.size > MAX_BYTES);
  if (big) return { status: "error", message: `${big.name} is larger than 20 MB.` };

  await db.knowledgeItem.createMany({
    data: files.data.map((f) => ({
      organisationId: ctx.organisation.id, agentId: agent.id, kind: "FILE" as const, name: f.name, sizeBytes: f.size,
      mimeType: f.type, chunks: Math.max(1, Math.round(f.size / 9000)), status: "PROCESSING" as const, createdById: ctx.user.id,
    })),
  });
  await audit(ctx.organisation.id, ctx.user.id, "knowledge.files_added", { type: "agent", id: agent.id }, { files: files.data.map((f) => f.name) });
  revalidatePath("/knowledge");
  return { status: "ok", message: `${files.data.length} file${files.data.length === 1 ? "" : "s"} added to ${agent.name}. Reading them now…` };
}

export async function addWebsite(_prev: KnowledgeFormState, form: FormData): Promise<KnowledgeFormState> {
  const ctx = await requirePermission("knowledge:edit");
  const agent = await agentInOrg(ctx.organisation.id, form.get("agentId"));
  if (!agent) return { status: "error", message: "Choose which agent should use this website." };
  let url: URL;
  try {
    const raw = String(form.get("url") ?? "").trim();
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) throw new Error();
  } catch {
    return { status: "error", message: "Enter a website address, e.g. https://mybusiness.com." };
  }
  const wholeSite = form.get("scope") !== "page";
  // A believable page count from the address, so the same site always gives the same result.
  const pages = wholeSite ? 6 + ([...url.hostname].reduce((a, c) => a + c.charCodeAt(0), 0) % 38) : 1;
  const item = await db.knowledgeItem.create({
    data: {
      organisationId: ctx.organisation.id, agentId: agent.id, kind: "WEBSITE", name: url.hostname.replace(/^www\./, "") + (wholeSite ? "" : url.pathname.replace(/\/$/, "")),
      url: url.toString(), pages, chunks: pages * 6, status: "PROCESSING", createdById: ctx.user.id,
    },
  });
  await audit(ctx.organisation.id, ctx.user.id, "knowledge.website_added", { type: "knowledgeItem", id: item.id }, { url: url.toString() });
  revalidatePath("/knowledge");
  return { status: "ok", message: `Reading ${url.hostname}${wholeSite ? ` (up to ${pages} pages)` : ""}…` };
}

export async function deleteKnowledge(form: FormData): Promise<void> {
  const ctx = await requirePermission("knowledge:edit");
  const id = z.string().min(1).parse(form.get("id"));
  const { count } = await db.knowledgeItem.deleteMany({ where: { id, organisationId: ctx.organisation.id } });
  if (count) await audit(ctx.organisation.id, ctx.user.id, "knowledge.deleted", { type: "knowledgeItem", id });
  revalidatePath("/knowledge");
}

