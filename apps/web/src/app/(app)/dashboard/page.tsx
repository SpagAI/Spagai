import { Bot, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const t = await getT();
  const [total, ready] = await Promise.all([
    db.agent.count({ where: { organisationId: ctx.organisation.id } }),
    db.agent.count({ where: { organisationId: ctx.organisation.id, status: "READY" } }),
  ]);
  const steps = [
    { key: "step1", done: total > 0 },
    { key: "step2", done: ready > 0 },
    { key: "step3", done: false },
    { key: "step4", done: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}, {ctx.organisation.name}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.intro")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{t("dashboard.agents")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{total}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{ready} {t("agents.status.READY").toLowerCase()}</span>
            <Button asChild size="sm">
              <Link href={total ? "/agents" : "/agents/new"}><Bot /> {total ? t("nav.agents") : t("dashboard.createAgent")}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.nextSteps")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  {s.done ? <CircleCheck className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
                  <span className={s.done ? "text-muted-foreground line-through" : ""}>{t(`dashboard.${s.key}`)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
