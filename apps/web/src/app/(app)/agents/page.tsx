import { agentConfigSchema, getVoice } from "@spagai/core";
import { BookOpen, Bot, Mic, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const ctx = await requireOrg();
  const t = await getT();
  const agents = await db.agent.findMany({
    where: { organisationId: ctx.organisation.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { knowledgeItems: true, phoneNumbers: { where: { status: "ACTIVE" } } } } },
  });
  const canCreate = can(ctx.role, "agent:edit");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("agents.title")}</h1>
          <p className="text-sm text-muted-foreground">Your AI voice agents. Create one from scratch or from a template, then give it a voice, knowledge and a phone number.</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/agents/new"><Plus /> {t("agents.new")}</Link>
          </Button>
        )}
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <Bot className="size-8" />
            <p>{t("agents.empty")}</p>
            {canCreate && <Button asChild><Link href="/agents/new"><Plus /> {t("agents.new")}</Link></Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`} className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{a.name}</CardTitle>
                    <Badge variant={a.status === "READY" ? "default" : "secondary"}>{t(`agents.status.${a.status}`)}</Badge>
                  </div>
                  <CardDescription>{a.presetId ? "From a template" : "Built from scratch"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1"><Mic className="size-3.5" /> {getVoice(agentConfigSchema.safeParse(a.config).data?.voiceId)?.name ?? "No voice yet"}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> {a._count.phoneNumbers ? `${a._count.phoneNumbers} number${a._count.phoneNumbers === 1 ? "" : "s"}` : "No number"}</span>
                    <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" /> {a._count.knowledgeItems} knowledge item{a._count.knowledgeItems === 1 ? "" : "s"}</span>
                  </div>
                  <p>{t("agents.updated")} {formatLagos(a.updatedAt)} WAT</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
