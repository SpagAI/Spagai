import { Bot, Plus } from "lucide-react";
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
  const agents = await db.agent.findMany({ where: { organisationId: ctx.organisation.id }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("agents.title")}</h1>
        {can(ctx.role, "agent:edit") && (
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
                  <CardDescription>{a.presetId ?? "custom"}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {t("agents.updated")} {formatLagos(a.updatedAt)} WAT
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
