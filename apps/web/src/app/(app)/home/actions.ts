"use server";

import { agentReadiness, getVoice, normaliseAgentConfig } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blankAgentDraft, presetAgentDraft } from "@/server/agent-factory";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export type BuildResult =
  | { ok: true; agentId: string; name: string; ready: boolean }
  | { ok: false; message: string };

const PlanSchema = z.object({
  agentName: z.string().trim().min(1).max(40),
  company: z.string().trim().min(1).max(120),
  direction: z.enum(["inbound", "outbound"]),
  presetId: z.string().max(100).nullable(),
  purpose: z.string().trim().max(2000),
  language: z.string().max(10),
  voiceId: z.string().max(100),
});

/** Zara builds the agent from the plan the person approved. */
export async function buildAgentFromPlan(raw: unknown): Promise<BuildResult> {
  const ctx = await requirePermission("agent:edit").catch(() => null);
  if (!ctx) return { ok: false, message: "Your role can look at agents but not create them. Ask an owner or admin." };
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something in the plan was not right. Please describe the agent again." };
  const plan = parsed.data;
  const voiceId = getVoice(plan.voiceId) ? plan.voiceId : null;

  const draft = (plan.presetId && presetAgentDraft(plan.presetId, { name: plan.agentName, company: plan.company, voiceId: voiceId ?? "", language: plan.language }))
    || blankAgentDraft({ name: plan.agentName, direction: plan.direction, purpose: plan.purpose, company: plan.company, language: plan.language, voiceId });
  const normalised = normaliseAgentConfig(draft);
  if (!normalised.ok) return { ok: false, message: "I could not put that agent together. Try describing it a little differently." };

  const readiness = agentReadiness(normalised.config);
  const agent = await db.agent.create({
    data: {
      organisationId: ctx.organisation.id, name: plan.agentName, presetId: plan.presetId, config: normalised.config,
      status: readiness.ready ? "READY" : "DRAFT", createdById: ctx.user.id,
    },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.created", { type: "agent", id: agent.id }, { from: "zara", presetId: plan.presetId });
  revalidatePath("/agents");
  revalidatePath("/home");
  return { ok: true, agentId: agent.id, name: agent.name, ready: readiness.ready };
}
