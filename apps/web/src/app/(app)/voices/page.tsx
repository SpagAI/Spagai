import { agentConfigSchema, orderVoices } from "@spagai/core";
import type { Metadata } from "next";
import { VoiceBank } from "@/components/voice/voice-bank";
import { VoiceLibrary } from "@/components/voice/voice-library";
import { getT } from "@/i18n/server";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { fishAudioConfigured } from "@/server/providers/fish-audio";
import { listWorkspaceVoices, speechUsedToday } from "@/server/voices";

export const metadata: Metadata = { title: "Voices" };

export default async function VoicesPage() {
  const ctx = await requireOrg();
  const t = await getT();
  const [agents, workspaceVoices, usage] = await Promise.all([
    db.agent.findMany({ where: { organisationId: ctx.organisation.id }, select: { id: true, name: true, config: true }, orderBy: { name: "asc" } }),
    listWorkspaceVoices(ctx.organisation.id),
    speechUsedToday(ctx.organisation.id),
  ]);

  // Which agents use each voice.
  const usedBy: Record<string, { id: string; name: string }[]> = {};
  for (const a of agents) {
    const voiceId = agentConfigSchema.safeParse(a.config).data?.voiceId;
    if (voiceId) (usedBy[voiceId] ??= []).push({ id: a.id, name: a.name });
  }
  const fishConnected = fishAudioConfigured();
  const canEdit = can(ctx.role, "agent:edit");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("voices.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("voices.intro")}</p>
        {fishConnected && (
          <p className="text-xs text-muted-foreground">
            Real voices today: {usage.used.toLocaleString("en-NG")} of {usage.limit.toLocaleString("en-NG")} characters used (resets at midnight, Lagos time).
          </p>
        )}
      </div>
      <VoiceLibrary usedBy={usedBy} workspaceVoices={workspaceVoices} canEdit={canEdit} fishConnected={fishConnected} />
      <VoiceBank configured={fishConnected} canEdit={canEdit} addedIds={orderVoices(workspaceVoices).filter((v) => v.provider === "fish_audio").map((v) => v.providerVoiceId)} />
    </div>
  );
}
