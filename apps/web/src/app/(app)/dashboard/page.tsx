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
  const org = { organisationId: ctx.organisation.id };
  const [total, ready, leads, campaigns, answered, booked, optedOut, blocked] = await Promise.all([
    db.agent.count({ where: org }),
    db.agent.count({ where: { ...org, status: "READY" } }),
    db.lead.count({ where: org }),
    db.campaign.count({ where: org }),
    db.call.count({ where: { ...org, status: "COMPLETED" } }),
    db.call.count({ where: { ...org, outcome: "booked" } }),
    db.lead.count({ where: { ...org, optedOut: true } }),
    db.call.count({ where: { ...org, status: "BLOCKED" } }),
  ]);
  const steps = [
    { key: "step1", done: total > 0, href: "/agents" },
    { key: "step2", done: ready > 0, href: "/agents" },
    { key: "step3", done: false, href: "/simulator" },
    { key: "step4", done: campaigns > 0, href: leads ? "/campaigns" : "/leads" },
  ];
  const stats: [string, number, string][] = [
    [t("dashboard.leads"), leads, "/leads"],
    [t("dashboard.answered"), answered, "/calls?status=COMPLETED"],
    [t("dashboard.booked"), booked, "/calls"],
    [t("dashboard.optedOut"), optedOut, "/leads"],
    [t("dashboard.blocked"), blocked, "/calls?status=BLOCKED"],
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
                  {s.done ? (
                    <span className="text-muted-foreground line-through">{t(`dashboard.${s.key}`)}</span>
                  ) : (
                    <Link href={s.href} className="underline-offset-2 hover:underline">{t(`dashboard.${s.key}`)}</Link>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
