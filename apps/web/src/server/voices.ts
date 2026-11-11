import "server-only";
import { getVoice, toLagosParts, type Voice } from "@spagai/core";
import { parseBankVoiceId, workspaceVoiceToVoice } from "@/lib/voice-bank";
import { db } from "./db";
import { env } from "./env";

/** Voices this workspace added from a voice bank, newest first, in catalogue shape. */
export async function listWorkspaceVoices(organisationId: string): Promise<Voice[]> {
  const rows = await db.workspaceVoice.findMany({ where: { organisationId }, orderBy: { createdAt: "desc" } });
  return rows.map(workspaceVoiceToVoice);
}

/** Find a voice by id: a built-in catalogue voice, or one this workspace added. */
export async function resolveVoice(organisationId: string, voiceId: string | null | undefined): Promise<Voice | undefined> {
  const builtIn = getVoice(voiceId);
  if (builtIn) return builtIn;
  const bank = parseBankVoiceId(voiceId);
  if (!bank) return undefined;
  const row = await db.workspaceVoice.findUnique({
    where: { organisationId_provider_providerVoiceId: { organisationId, provider: bank.provider, providerVoiceId: bank.providerVoiceId } },
  });
  return row ? workspaceVoiceToVoice(row) : undefined;
}

/** A lookup for pages that show many agents' voices at once. */
export async function voiceNameLookup(organisationId: string): Promise<(voiceId: string | null | undefined) => Voice | undefined> {
  const own = new Map((await listWorkspaceVoices(organisationId)).map((v) => [v.id, v]));
  return (voiceId) => getVoice(voiceId) ?? (voiceId ? own.get(voiceId) : undefined);
}

function lagosDay(now = new Date()): string {
  const p = toLagosParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Cost guard: reserve `characters` of today's real-speech allowance for this workspace.
 * Returns false (and reserves nothing) when it would go over VOICE_DAILY_CHAR_LIMIT.
 */
export async function reserveSpeechCharacters(organisationId: string, characters: number, now = new Date()): Promise<boolean> {
  const day = lagosDay(now);
  // One atomic statement: add only if the total stays within the limit.
  // The ::int casts matter: on Cloudflare the database driver sends numbers untyped, and without
  // them Postgres compares "93" and "50000" as text and refuses (9 sorts after 5).
  const updated = await db.$executeRaw`
    INSERT INTO "VoiceUsage" ("organisationId", "day", "characters")
    SELECT ${organisationId}, ${day}, ${characters}::int
    WHERE ${characters}::int <= ${env.VOICE_DAILY_CHAR_LIMIT}::int
    ON CONFLICT ("organisationId", "day") DO UPDATE
      SET "characters" = "VoiceUsage"."characters" + EXCLUDED."characters"
      WHERE "VoiceUsage"."characters" + EXCLUDED."characters" <= ${env.VOICE_DAILY_CHAR_LIMIT}::int`;
  return updated > 0;
}

/** Give characters back when speech could not be created, so failures do not use up the allowance. */
export async function releaseSpeechCharacters(organisationId: string, characters: number, now = new Date()): Promise<void> {
  await db.voiceUsage.updateMany({
    where: { organisationId, day: lagosDay(now) },
    data: { characters: { decrement: characters } },
  });
}

export async function speechUsedToday(organisationId: string, now = new Date()): Promise<{ used: number; limit: number }> {
  const row = await db.voiceUsage.findUnique({ where: { organisationId_day: { organisationId, day: lagosDay(now) } } });
  return { used: row?.characters ?? 0, limit: env.VOICE_DAILY_CHAR_LIMIT };
}
