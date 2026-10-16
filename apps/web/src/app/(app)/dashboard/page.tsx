import { Bot, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusiestHours, CallsOverTime, DurationChart, StatTiles, TopAgents } from "@/components/dashboard/charts";
import { CallMap } from "@/components/dashboard/world-map";
import { Button } from "@/components/ui/button";
import { WaveBanner } from "@/components/wave-banner";
import { getT } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { loadDashboard } from "@/server/analytics";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = [7, 14, 30] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireOrg();
  const t = await getT();
  const requested = Number((await searchParams).days);
  const days = RANGES.find((r) => r === requested) ?? 30;
  const org = { organisationId: ctx.organisation.id };
  const [data, total, ready, leads, campaigns] = await Promise.all([
    loadDashboard(ctx.organisation.id, days),
    db.agent.count({ where: org }),
    db.agent.count({ where: { ...org, status: "READY" } }),
    db.lead.count({ where: org }),
    db.campaign.count({ where: org }),
  ]);
  const steps = [
    { key: "step1", done: total > 0, href: "/agents" },
    { key: "step2", done: ready > 0, href: "/agents" },
    { key: "step3", done: data.current.calls > 0, href: "/lab" },
    { key: "step4", done: campaigns > 0, href: leads ? "/campaigns" : "/leads" },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      <WaveBanner className="flex min-h-44 flex-col justify-end p-6 sm:min-h-52 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t("dashboard.title")}, {ctx.organisation.name}</h1>
        <p className="mt-1 text-sm text-white/75">{t("dashboard.intro")}</p>
      </WaveBanner>

      {!allDone && (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("dashboard.nextSteps")}</h2>
          <ol className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                {s.done ? <CircleCheck className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
                {s.done ? <span className="text-muted-foreground line-through">{t(`dashboard.${s.key}`)}</span> : <Link href={s.href} className="underline-offset-2 hover:underline">{t(`dashboard.${s.key}`)}</Link>}
              </li>
            ))}
          </ol>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={total ? "/agents" : "/agents/new"}><Bot /> {total ? `${total} ${t("nav.agents").toLowerCase()} · ${ready} ${t("agents.status.READY").toLowerCase()}` : t("dashboard.createAgent")}</Link>
          </Button>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Overview</h2>
        <nav aria-label="Date range" className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard?days=${r}`}
              scroll={false}
              aria-current={r === days ? "page" : undefined}
              className={cn("rounded-md px-3 py-1 transition-colors", r === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Last {r} days
            </Link>
          ))}
        </nav>
      </div>

      <StatTiles data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <CallsOverTime series={data.series} />
        <DurationChart durations={data.durations} avgSeconds={data.current.avgSeconds} />
        <CallMap locations={data.locations} />
        <BusiestHours hours={data.hours} />
        <div className="lg:col-span-2"><TopAgents agents={data.agents} /></div>
      </div>
    </div>
  );
}
