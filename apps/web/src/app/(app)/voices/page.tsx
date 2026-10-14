import { agentConfigSchema } from "@spagai/core";
import type { Metadata } from "next";
import { VoiceLibrary } from "@/components/voice/voice-library";
import { getT } from "@/i18n/server";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Voices" };

export default async function VoicesPage() {
  const ctx = await requireOrg();
  const t = await getT();
  const agents = await db.agent.findMany({
    where: { organisationId: ctx.organisation.id },
    select: { id: true, name: true, config: true },
    orderBy: { name: "asc" },
  });

  // Which agents use each voice.
  const usedBy: Record<string, { id: string; name: string }[]> = {};
  for (const a of agents) {
    const voiceId = agentConfigSchema.safeParse(a.config).data?.voiceId;
    if (voiceId) (usedBy[voiceId] ??= []).push({ id: a.id, name: a.name });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("voices.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("voices.intro")}</p>
      </div>
      <VoiceLibrary usedBy={usedBy} />
    </div>
  );
}
