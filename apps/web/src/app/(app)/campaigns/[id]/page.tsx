import { formatNigerianPhone, toLagosParts } from "@spagai/core";
import { ArrowLeft, Pause, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { CALL_STATUS_VARIANT, CAMPAIGN_STATUS_VARIANT } from "@/lib/status";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { can } from "@/server/permissions";
import { setCampaignStatus } from "../actions";
import { RunPanel } from "./run-panel";

export const metadata: Metadata = { title: "Campaign" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireOrg();
  const t = await getT();
  const campaign = await db.campaign.findFirst({ where: { id, organisationId: ctx.organisation.id }, include: { agent: true } });
  if (!campaign) notFound();

  const [byStatus, outcomes, blocked, leads, calls] = await Promise.all([
    db.campaignLead.groupBy({ by: ["status"], where: { campaignId: id }, _count: true }),
    db.call.groupBy({ by: ["outcome"], where: { campaignId: id, status: { in: ["COMPLETED", "NO_ANSWER"] } }, _count: true }),
    db.call.count({ where: { campaignId: id, status: "BLOCKED" } }),
    db.campaignLead.findMany({ where: { campaignId: id }, include: { lead: true }, orderBy: [{ status: "asc" }, { lastAttemptAt: "desc" }], take: 200 }),
    db.call.findMany({ where: { campaignId: id }, include: { lead: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const outcome = (o: string) => outcomes.find((x) => x.outcome === o)?._count ?? 0;
  const canRun = can(ctx.role, "campaign:run");
  const p = toLagosParts(new Date());
  const nowLocal = `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href="/campaigns"><ArrowLeft /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            <Link className="underline-offset-2 hover:underline" href={`/agents/${campaign.agentId}`}>{campaign.agent.name}</Link>
            {" · "}{campaign.windowStart}–{campaign.windowEnd} WAT · {campaign.days.map((d) => DAYS[d]).join(", ")}
            {" · "}{t("campaigns.maxAttempts")}: {campaign.maxAttempts}
          </p>
        </div>
        <Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{t(`campaigns.status.${campaign.status}`)}</Badge>
        {canRun && campaign.status !== "COMPLETED" && (
          <form action={setCampaignStatus}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <input type="hidden" name="status" value={campaign.status === "RUNNING" ? "PAUSED" : "RUNNING"} />
            <Button type="submit" variant={campaign.status === "RUNNING" ? "outline" : "default"}>
              {campaign.status === "RUNNING" ? <><Pause /> {t("campaigns.pause")}</> : <><Play /> {t("campaigns.start")}</>}
            </Button>
          </form>
        )}
      </div>

      {(query.error === "agent-not-ready" || campaign.agent.status !== "READY") && campaign.status !== "COMPLETED" && (
        <Alert variant="warning">
          {t("campaigns.agentNotReady")} <Link className="underline" href={`/agents/${campaign.agentId}`}>{t("simulator.editAgent")}</Link>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t("campaigns.waiting"), count("PENDING")],
          [t("campaigns.done"), count("DONE")],
          [t("campaigns.stopped"), count("STOPPED")],
          [t("campaigns.blockedAttempts"), blocked],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {canRun && campaign.status === "RUNNING" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("campaigns.runTitle")}</CardTitle>
            <CardDescription>{t("campaigns.runIntro")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RunPanel campaignId={campaign.id} initialTime={nowLocal} mock={env.TELEPHONY_PROVIDER === "mock"} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("campaigns.outcomes")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(["booked", "callback", "not_interested", "opted_out", "wrong_number", "no_answer", "other"] as const).map((o) => (
            <Badge key={o} variant="outline" className="text-sm">{t(`calls.outcome.${o}`)}: <span className="tabular-nums">{outcome(o)}</span></Badge>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("campaigns.people")}</CardTitle></CardHeader>
          <CardContent className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">{t("leads.name")}</th>
                  <th className="py-2 pr-3 font-medium">{t("leads.status")}</th>
                  <th className="py-2 pr-3 font-medium">{t("campaigns.tries")}</th>
                  <th className="py-2 font-medium">{t("campaigns.result")}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((cl) => (
                  <tr key={cl.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      {cl.lead.firstName} {cl.lead.lastName}
                      <span className="block font-mono text-[11px] text-muted-foreground">{formatNigerianPhone(cl.lead.phone)}</span>
                    </td>
                    <td className="py-2 pr-3"><Badge variant={cl.status === "STOPPED" ? "destructive" : cl.status === "DONE" ? "secondary" : "outline"}>{t(`campaigns.leadStatus.${cl.status}`)}</Badge></td>
                    <td className="py-2 pr-3 tabular-nums">{cl.attempts}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {cl.outcome ? t(`calls.outcome.${cl.outcome}`) : "—"}
                      {cl.status === "PENDING" && cl.nextAttemptAt && <span className="block">{t("campaigns.next")} {formatLagos(cl.nextAttemptAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("campaigns.recentCalls")}</CardTitle>
            <CardDescription><Link className="underline" href={`/calls?campaign=${campaign.id}`}>{t("campaigns.allCalls")}</Link></CardDescription>
          </CardHeader>
          <CardContent>
            {calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("campaigns.noCalls")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {calls.map((c) => (
                  <li key={c.id}>
                    <Link href={`/calls/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:text-primary">
                      <span>{c.lead.firstName} {c.lead.lastName}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {formatLagos(c.attemptedAt)}
                        <Badge variant={CALL_STATUS_VARIANT[c.status]}>{c.status === "BLOCKED" || c.status === "FAILED" ? t(`calls.status.${c.status}`) : t(`calls.outcome.${c.outcome ?? "other"}`)}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
