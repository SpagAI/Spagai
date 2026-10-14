"use server";

import { fromLagosParts } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { audit } from "@/server/agents";
import { db } from "@/server/db";
import { runCampaignBatch, type BatchSummary } from "@/server/dialer";
import { env } from "@/server/env";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export async function createCampaign(form: FormData): Promise<void> {
  const ctx = await requirePermission("campaign:run");
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      agentId: z.string().min(1),
      source: z.string().max(120),
      windowStart: hhmm,
      windowEnd: hhmm,
      days: z.array(z.coerce.number().int().min(0).max(6)).min(1),
      maxAttempts: z.coerce.number().int().min(1).max(5),
      retryAfterMinutes: z.coerce.number().int().min(30).max(10080),
    })
    .refine((v) => v.windowEnd > v.windowStart, { message: "window" })
    .safeParse({
      name: form.get("name"),
      agentId: form.get("agentId"),
      source: form.get("source") ?? "",
      windowStart: form.get("windowStart"),
      windowEnd: form.get("windowEnd"),
      days: form.getAll("days"),
      maxAttempts: form.get("maxAttempts"),
      retryAfterMinutes: form.get("retryAfterMinutes"),
    });
  if (!parsed.success) redirect("/campaigns?error=form");
  const { source, ...data } = parsed.data;

  const agent = await db.agent.findFirst({ where: { id: data.agentId, organisationId: ctx.organisation.id } });
  if (!agent) redirect("/campaigns?error=agent");

  // Every matching lead is added, including ones the gate will block, so the blocks are visible and logged.
  const leads = await db.lead.findMany({
    where: { organisationId: ctx.organisation.id, ...(source && { source }) },
    select: { id: true },
  });
  if (leads.length === 0) redirect("/campaigns?error=no-leads");

  const campaign = await db.campaign.create({
    data: {
      ...data,
      days: [...new Set(data.days)].sort(),
      organisationId: ctx.organisation.id,
      createdById: ctx.user.id,
      leads: { create: leads.map((l) => ({ leadId: l.id })) },
    },
  });
  await audit(ctx.organisation.id, ctx.user.id, "campaign.created", { type: "campaign", id: campaign.id }, { leads: leads.length, source: source || "all" });
  redirect(`/campaigns/${campaign.id}`);
}

export async function setCampaignStatus(form: FormData): Promise<void> {
  const ctx = await requirePermission("campaign:run");
  const id = z.string().min(1).parse(form.get("campaignId"));
  const status = z.enum(["RUNNING", "PAUSED"]).parse(form.get("status"));
  const campaign = await db.campaign.findFirst({ where: { id, organisationId: ctx.organisation.id }, include: { agent: true } });
  if (!campaign || campaign.status === "COMPLETED") redirect(`/campaigns/${id}`);
  if (status === "RUNNING" && campaign.agent.status !== "READY") redirect(`/campaigns/${id}?error=agent-not-ready`);
  await db.campaign.update({ where: { id }, data: { status } });
  await audit(ctx.organisation.id, ctx.user.id, status === "RUNNING" ? "campaign.started" : "campaign.paused", { type: "campaign", id });
  revalidatePath(`/campaigns/${id}`);
  redirect(`/campaigns/${id}`);
}

export type BatchState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; summary: BatchSummary; at: string };

export async function runBatch(_prev: BatchState, form: FormData): Promise<BatchState> {
  const ctx = await requirePermission("campaign:run");
  const campaignId = z.string().min(1).parse(form.get("campaignId"));
  const limit = z.coerce.number().int().min(1).max(50).catch(10).parse(form.get("limit"));

  // A pretend time is only allowed with mock telephony: it lets you test outside office hours.
  let now = new Date();
  const pretend = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).safeParse(form.get("pretendTime"));
  if (pretend.success && env.TELEPHONY_PROVIDER === "mock") {
    const [d, t] = pretend.data.split("T") as [string, string];
    const [y, mo, day] = d.split("-").map(Number) as [number, number, number];
    const [h, mi] = t.split(":").map(Number) as [number, number];
    now = fromLagosParts(y, mo, day, h, mi);
  }

  try {
    const summary = await runCampaignBatch({ organisationId: ctx.organisation.id, actorUserId: ctx.user.id, campaignId, now, limit });
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath("/calls");
    return { status: "done", summary, at: now.toISOString() };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "The calls could not be run." };
  }
}
