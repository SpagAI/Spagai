import { Bot, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Simulator" };

export default async function SimulatorIndex() {
  const ctx = await requireOrg();
  const t = await getT();
  const agents = await db.agent.findMany({ where: { organisationId: ctx.organisation.id }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("simulator.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("simulator.intro")}</p>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <Bot className="size-8" />
            <p>{t("agents.empty")}</p>
            <Button asChild><Link href="/agents/new">{t("agents.new")}</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{a.name}</CardTitle>
                  <Badge variant={a.status === "READY" ? "default" : "secondary"}>{t(`agents.status.${a.status}`)}</Badge>
                </div>
                <CardDescription>{a.presetId ?? "custom"}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={`/simulator/${a.id}`}><FlaskConical /> {t("simulator.test")}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
