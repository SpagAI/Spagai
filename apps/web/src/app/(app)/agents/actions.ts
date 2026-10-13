"use server";

import { agentReadiness, getPreset, normaliseAgentConfig, presetToAgentConfig, type AgentConfig } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { audit, loadAgent } from "@/server/agents";
import { db } from "@/server/db";

export async function createAgentFromPreset(form: FormData): Promise<void> {
  const ctx = await requirePermission("agent:edit");
  const presetId = z.string().min(1).max(100).parse(form.get("presetId"));
  const preset = getPreset(presetId);
  if (!preset) throw new Error("Unknown preset.");

  const config = presetToAgentConfig(preset);
  const agent = await db.agent.create({
    data: { organisationId: ctx.organisation.id, name: config.name, presetId, config, createdById: ctx.user.id },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.created", { type: "agent", id: agent.id }, { presetId });
  redirect(`/agents/${agent.id}`);
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
