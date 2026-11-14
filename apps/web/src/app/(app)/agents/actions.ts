"use server";

import { agentConfigSchema, agentDraftSchema, agentReadiness, getPreset, normaliseAgentConfig, presetToAgentConfig, type AgentConfig } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { blankAgentDraft } from "@/server/agent-factory";
import { audit, loadAgent } from "@/server/agents";
import { db } from "@/server/db";
import { resolveVoice } from "@/server/voices";
import { customAgentDraft, customAgentSchema } from "@/lib/custom-agent";

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

  const org = ctx.organisation.id;
  const updated = await db.$transaction(async (tx) => {
    // Version history: the first save also keeps what was there before, so it can be restored.
    if ((await tx.agentVersion.count({ where: { agentId: existing.id } })) === 0) {
      await tx.agentVersion.create({ data: { agentId: existing.id, organisationId: org, config: existing.config, status: existing.status, savedById: null, createdAt: existing.updatedAt } });
    }
    await tx.agentVersion.create({ data: { agentId: existing.id, organisationId: org, config: normalised.config, status, savedById: ctx.user.id } });
    // Keep the newest 50.
    const old = await tx.agentVersion.findMany({ where: { agentId: existing.id }, orderBy: { createdAt: "desc" }, skip: MAX_VERSIONS, select: { id: true } });
    if (old.length) await tx.agentVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
    // Saved for real: the autosaved draft is no longer needed.
    await tx.agentDraft.deleteMany({ where: { agentId: existing.id } });
    return tx.agent.update({
      where: { id: existing.id },
      data: { name: normalised.config.name, config: normalised.config, status },
    });
  });
  await audit(org, ctx.user.id, "agent.saved", { type: "agent", id: existing.id }, { status });
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
  // This kind's business details, sent as detail_<name>.
  const details = Object.fromEntries([...form.entries()].filter(([k, v]) => k.startsWith("detail_") && typeof v === "string").map(([k, v]) => [k.slice(7), v]));
  const draft = blankAgentDraft({ ...input, company: input.company || ctx.organisation.name, language: "en-NG", voiceId, details });
  const normalised = normaliseAgentConfig(draft);
  if (!normalised.ok) throw new Error(normalised.errors.join("; "));
  const agent = await db.agent.create({
    data: { organisationId: ctx.organisation.id, name: input.name, presetId: null, config: normalised.config, createdById: ctx.user.id },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.created", { type: "agent", id: agent.id }, { from: "scratch" });
  redirect(`/agents/${agent.id}?new=1`);
}

export type CreateCustomResult = { ok: false; errors: string[] };

/** "Custom": the person wrote the prompt, first message and voice settings themselves. Saved as written. */
export async function createCustomAgent(input: unknown): Promise<CreateCustomResult> {
  const ctx = await requirePermission("agent:edit");
  const parsed = customAgentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const data = parsed.data;
  // Only keep a voice that this workspace can use, in the agent's language.
  const voice = data.voiceId ? await resolveVoice(ctx.organisation.id, data.voiceId) : undefined;
  const voiceId = voice && voice.status === "available" && voice.language === data.language ? voice.id : null;
  const normalised = normaliseAgentConfig(customAgentDraft({ ...data, voiceId }));
  if (!normalised.ok) return { ok: false, errors: normalised.errors };
  const agent = await db.agent.create({
    data: { organisationId: ctx.organisation.id, name: data.name, presetId: null, config: normalised.config, createdById: ctx.user.id },
  });
  await audit(ctx.organisation.id, ctx.user.id, "agent.created", { type: "agent", id: agent.id }, { from: "custom" });
  redirect(`/agents/${agent.id}?new=1`);
}

const MAX_VERSIONS = 50;
/** Autosaved drafts can be large (long prompts) but not unlimited. */
const MAX_DRAFT_BYTES = 400_000;

export type AutosaveResult = { ok: true; savedAt: string } | { ok: false; message: string };

/**
 * Autosave: keep unsaved changes as a draft. The live agent (Agent.config) is not touched,
 * so half-written changes never reach real calls; only "Save" does that.
 */
export async function autosaveAgentDraft(agentId: string, input: unknown): Promise<AutosaveResult> {
  const ctx = await requirePermission("agent:edit");
  const id = z.string().min(1).max(100).safeParse(agentId);
  if (!id.success) return { ok: false, message: "Agent not found." };
  if (JSON.stringify(input ?? null).length > MAX_DRAFT_BYTES) return { ok: false, message: "This draft is too large to keep." };
  const parsed = agentDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This draft could not be kept." };
  const agent = await db.agent.findFirst({ where: { id: id.data, organisationId: ctx.organisation.id }, select: { id: true } });
  if (!agent) return { ok: false, message: "Agent not found." };
  const draft = await db.agentDraft.upsert({
    where: { agentId: agent.id },
    create: { agentId: agent.id, config: parsed.data, savedById: ctx.user.id },
    update: { config: parsed.data, savedById: ctx.user.id },
  });
  return { ok: true, savedAt: draft.updatedAt.toISOString() };
}

/** Throw away the autosaved draft (the editor goes back to the last saved version). */
export async function discardAgentDraft(agentId: string): Promise<void> {
  const ctx = await requirePermission("agent:edit");
  await db.agentDraft.deleteMany({ where: { agentId: z.string().min(1).max(100).parse(agentId), agent: { organisationId: ctx.organisation.id } } });
}

export interface AgentVersionSummary {
  id: string;
  savedAt: string;
  savedBy: string | null;
  status: "DRAFT" | "READY";
  /** The person's own instructions (not the safety rules), for a quick look. */
  prompt: string;
  firstMessage: string;
}

/** Saved versions of an agent, newest first. */
export async function listAgentVersions(agentId: string): Promise<{ versions: AgentVersionSummary[]; configs: Record<string, AgentConfig> }> {
  const ctx = await requirePermission("agent:view");
  const rows = await db.agentVersion.findMany({
    where: { agentId: z.string().min(1).max(100).parse(agentId), organisationId: ctx.organisation.id },
    orderBy: { createdAt: "desc" },
    take: MAX_VERSIONS,
  });
  const userIds = [...new Set(rows.map((r) => r.savedById).filter((x): x is string => !!x))];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u.name || u.email]));
  const versions: AgentVersionSummary[] = [];
  const configs: Record<string, AgentConfig> = {};
  for (const r of rows) {
    const parsed = agentConfigSchema.safeParse(r.config);
    if (!parsed.success) continue;
    configs[r.id] = parsed.data;
    versions.push({
      id: r.id,
      savedAt: r.createdAt.toISOString(),
      savedBy: r.savedById ? users.get(r.savedById) ?? null : null,
      status: r.status,
      prompt: parsed.data.blocks.filter((b) => !b.guardrail).map((b) => b.content.trim()).filter(Boolean).join("\n\n"),
      firstMessage: parsed.data.firstMessage,
    });
  }
  return { versions, configs };
}
