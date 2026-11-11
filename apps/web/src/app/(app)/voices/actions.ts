"use server";

import { revalidatePath } from "next/cache";
import { agentConfigSchema, getVoice } from "@spagai/core";
import { z } from "zod";
import { FISH_PROVIDER, bankVoiceId, isFishVoiceId } from "@/lib/voice-bank";
import { audit } from "@/server/agents";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { synthesise, type SpeechResult } from "@/server/providers";
import { fishAudioConfigured, getFishVoice, searchFishVoices, type BankPage } from "@/server/providers/fish-audio";

/** Speak a line in one voice. The text is cleaned for speech on the server first. */
export async function previewVoice(voiceId: string, text: string): Promise<SpeechResult> {
  const ctx = await requirePermission("agent:view");
  const input = z.object({ voiceId: z.string().min(1).max(100), text: z.string().max(1000) }).safeParse({ voiceId, text });
  if (!input.success) return { kind: "error", message: "That line is too long." };
  try {
    return await synthesise(ctx.organisation.id, input.data.voiceId, input.data.text);
  } catch {
    return { kind: "error", message: "The voice could not be played. Please try again." };
  }
}

export type BankSearchResult = { ok: true; page: BankPage } | { ok: false; message: string };

const searchSchema = z.object({
  query: z.string().trim().max(60),
  gender: z.enum(["", "female", "male"]),
  page: z.number().int().min(1).max(50),
});

/** Search the Fish Audio voice bank. Browsing and samples are free. */
export async function searchVoiceBank(input: { query: string; gender: string; page: number }): Promise<BankSearchResult> {
  await requirePermission("agent:view");
  if (!fishAudioConfigured()) return { ok: false, message: "Fish Audio is not connected yet. Add FISH_AUDIO_API_KEY to the site's settings." };
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check your search." };
  try {
    return { ok: true, page: await searchFishVoices(parsed.data) };
  } catch {
    return { ok: false, message: "The voice bank could not be reached. Please try again." };
  }
}

export type VoiceChangeResult = { ok: true; voiceId: string } | { ok: false; message: string };

/** Add a Fish Audio voice to this workspace. Its details are read from Fish Audio, not from the browser. */
export async function addBankVoice(providerVoiceId: string): Promise<VoiceChangeResult> {
  const ctx = await requirePermission("agent:edit");
  if (!isFishVoiceId(providerVoiceId)) return { ok: false, message: "Unknown voice." };
  // Built-in Fish Audio voices are already in every workspace.
  if (getVoice(bankVoiceId(FISH_PROVIDER, providerVoiceId))) return { ok: true, voiceId: bankVoiceId(FISH_PROVIDER, providerVoiceId) };
  if (!fishAudioConfigured()) return { ok: false, message: "Fish Audio is not connected yet." };
  const count = await db.workspaceVoice.count({ where: { organisationId: ctx.organisation.id } });
  if (count >= 100) return { ok: false, message: "This workspace already has 100 voices. Remove one first." };

  let voice;
  try {
    voice = await getFishVoice(providerVoiceId);
  } catch {
    return { ok: false, message: "Fish Audio could not be reached. Please try again." };
  }
  if (!voice) return { ok: false, message: "That voice is no longer available on Fish Audio." };

  const data = {
    name: voice.name,
    gender: voice.gender,
    language: voice.language,
    accent: voice.accent,
    description: voice.description,
    age: voice.age,
    sampleUrl: voice.sampleUrl,
  };
  await db.workspaceVoice.upsert({
    where: { organisationId_provider_providerVoiceId: { organisationId: ctx.organisation.id, provider: FISH_PROVIDER, providerVoiceId } },
    create: { organisationId: ctx.organisation.id, provider: FISH_PROVIDER, providerVoiceId, addedById: ctx.user.id, ...data },
    update: data,
  });
  const id = bankVoiceId(FISH_PROVIDER, providerVoiceId);
  await audit(ctx.organisation.id, ctx.user.id, "voice.added", { type: "voice", id }, { name: voice.name, provider: FISH_PROVIDER });
  revalidatePath("/voices");
  return { ok: true, voiceId: id };
}

/** Remove a bank voice from this workspace, unless an agent still uses it. */
export async function removeBankVoice(voiceId: string): Promise<VoiceChangeResult> {
  const ctx = await requirePermission("agent:edit");
  const m = /^fish_audio:([a-f0-9]{32})$/.exec(voiceId);
  if (!m) return { ok: false, message: "Unknown voice." };
  const agents = await db.agent.findMany({ where: { organisationId: ctx.organisation.id }, select: { name: true, config: true } });
  const users = agents.filter((a) => agentConfigSchema.safeParse(a.config).data?.voiceId === voiceId).map((a) => a.name);
  if (users.length) return { ok: false, message: `This voice is used by ${users.join(", ")}. Choose another voice for ${users.length === 1 ? "that agent" : "those agents"} first.` };
  await db.workspaceVoice.deleteMany({ where: { organisationId: ctx.organisation.id, provider: FISH_PROVIDER, providerVoiceId: m[1]! } });
  await audit(ctx.organisation.id, ctx.user.id, "voice.removed", { type: "voice", id: voiceId });
  revalidatePath("/voices");
  return { ok: true, voiceId };
}
