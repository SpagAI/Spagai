"use server";

import { agentReadiness, getPreset, normaliseAgentConfig, presetToAgentConfig, type AgentConfig } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { blankAgentDraft } from "@/server/agent-factory";
import { audit, loadAgent } from "@/server/agents";
import { db } from "@/server/db";
import { resolveVoice } from "@/server/voices";

/**
 * The voice picked on the "Create an agent" page, if it is a real, usable voice for this
 * workspace in the agent's language. Anything else is ignored (the voice is chosen later).
 */
async function chosenVoice(organisationId: string, form: FormData, language: string): Promise<string | null> {
  const raw = form.get("voiceId");
  if (typeof raw !== "string" || !raw || raw.length > 100) return null;
  const voice = await resolveVoice(organisationId, raw);
  return voice && voice.status === "available" && voice.language === language ? voice.id : null;
}

export async function createAgentFromPreset(form: FormData): Promise<void> {
  const ctx = await requirePermission("agent:edit");
  const presetId = z.string().min(1).max(100).parse(form.get("presetId"));
  const preset = getPreset(presetId);
  if (!preset) throw new Error("Unknown preset.");

  const base = presetToAgentConfig(preset);
  const config = { ...base, voiceId: (await chosenVoice(ctx.organisation.id, form, base.language)) ?? base.voiceId };
  const agent = await db.agent.create({
    data: { organisationId: ctx.organisation.id, name: config.name, presetId, config, createdById: ctx.user.id },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.created", { type: "agent", id: agent.id }, { presetId });
  redirect(`/agents/${agent.id}?new=1`);
}

export type SaveAgentResult =
  | { ok: true; savedAt: string; status: "DRAFT" | "READY"; config: AgentConfig }
  | { ok: false; errors: string[] };

export async function saveAgent(agentId: string, input: unknown, status: "DRAFT" | "READY"): Promise<SaveAgentResult> {
  const ctx = await requirePermission("agent:edit");
  const existing = await loadAgent(ctx.organisation.id, z.string().min(1).parse(agentId));
  if (!existing) return { ok: false, errors: ["Agent not found."] };

  // Server-side checks: validation, locked guardrails put back, required tools added.
  const normalised = normaliseAgentConfig(input);
  if (!normalised.ok) return { ok: false, errors: normalised.errors };

  if (status === "READY") {
    const readiness = agentReadiness(normalised.config);
    if (!readiness.ready) return { ok: false, errors: readiness.problems };
  }

  const updated = await db.agent.update({
    where: { id: existing.id },
    data: { name: normalised.config.name, config: normalised.config, status },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.saved", { type: "agent", id: existing.id }, { status });
  revalidatePath("/agents");
  return { ok: true, savedAt: updated.updatedAt.toISOString(), status, config: normalised.config };
}

export async function deleteAgent(form: FormData): Promise<void> {
  const ctx = await requirePermission("agent:delete");
  const agentId = z.string().min(1).parse(form.get("agentId"));
  const result = await db.agent.deleteMany({ where: { id: agentId, organisationId: ctx.organisation.id } });
  if (result.count > 0) await audit(ctx.organisation.id, ctx.user.id, "agent.deleted", { type: "agent", id: agentId });
  revalidatePath("/agents");
  redirect("/agents");
}

/** A new agent from scratch: just a name, what it should do and its business, plus the standard guardrails. */
export async function createBlankAgent(form: FormData): Promise<void> {
  const ctx = await requirePermission("agent:edit");
  const input = z.object({
    name: z.string().trim().min(1).max(80),
    direction: z.enum(["inbound", "outbound"]),
    purpose: z.string().trim().max(2000),
    company: z.string().trim().max(120),
  }).parse({ name: form.get("name"), direction: form.get("direction"), purpose: form.get("purpose") ?? "", company: form.get("company") ?? "" });

  const voiceId = await chosenVoice(ctx.organisation.id, form, "en-NG");
  const draft = blankAgentDraft({ ...input, company: input.company || ctx.organisation.name, language: "en-NG", voiceId });
  const normalised = normaliseAgentConfig(draft);
  if (!normalised.ok) throw new Error(normalised.errors.join("; "));
  const agent = await db.agent.create({
    data: { organisationId: ctx.organisation.id, name: input.name, presetId: null, config: normalised.config, createdById: ctx.user.id },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.created", { type: "agent", id: agent.id }, { from: "scratch" });
  redirect(`/agents/${agent.id}?new=1`);
}
