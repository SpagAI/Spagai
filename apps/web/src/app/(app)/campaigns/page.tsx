import { Megaphone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { CAMPAIGN_STATUS_VARIANT } from "@/lib/status";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { createCampaign } from "./actions";

export const metadata: Metadata = { title: "Campaigns" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ERRORS: Record<string, string> = {
  form: "Check the form: a name, an agent, at least one day, and an end time later than the start time.",
  agent: "Agent not found.",
  "no-leads": "No leads match. Import leads first, or choose another source.",
};


export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await requireOrg();
  const t = await getT();
  const org = { organisationId: ctx.organisation.id };
  const [campaigns, agents, sources] = await Promise.all([
    db.campaign.findMany({
      where: org,
      include: { agent: { select: { name: true } }, _count: { select: { leads: true, calls: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.agent.findMany({ where: org, select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    db.lead.groupBy({ by: ["source"], where: org, _count: true, orderBy: { source: "asc" } }),
  ]);
  const totalLeads = sources.reduce((s, x) => s + x._count, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("campaigns.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("campaigns.intro")}</p>
      </div>
      {params.error && <Alert variant="destructive">{ERRORS[params.error] ?? t("common.error")}</Alert>}

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <Megaphone className="size-8" />
            <p>{t("campaigns.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{c.name}</CardTitle>
                    <Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{t(`campaigns.status.${c.status}`)}</Badge>
                  </div>
                  <CardDescription>{c.agent.name} · {c._count.leads} {t("campaigns.leads")} · {c._count.calls} {t("campaigns.attempts")}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">{t("agents.updated")} {formatLagos(c.updatedAt)} WAT</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {can(ctx.role, "campaign:run") && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>{t("campaigns.new")}</CardTitle>
            <CardDescription>{t("campaigns.newIntro")}</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 || totalLeads === 0 ? (
              <p className="text-sm text-muted-foreground">
                {agents.length === 0 ? t("campaigns.needAgent") : t("campaigns.needLeads")}{" "}
                <Link className="underline" href={agents.length === 0 ? "/agents/new" : "/leads"}>{agents.length === 0 ? t("agents.new") : t("nav.leads")}</Link>
              </p>
            ) : (
              <form action={createCampaign} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name">{t("campaigns.name")}</Label>
                  <Input id="name" name="name" required minLength={2} maxLength={80} placeholder={t("campaigns.namePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agentId">{t("campaigns.agent")}</Label>
                  <Select id="agentId" name="agentId" required>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}{a.status !== "READY" ? ` (${t("agents.status.DRAFT")})` : ""}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source">{t("campaigns.whichLeads")}</Label>
                  <Select id="source" name="source" defaultValue="">
                    <option value="">{t("campaigns.allLeads")} ({totalLeads})</option>
                    {sources.map((s) => <option key={s.source} value={s.source}>{s.source} ({s._count})</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="windowStart">{t("campaigns.from")}</Label>
                  <Input id="windowStart" name="windowStart" type="time" defaultValue="09:00" min="08:00" max="21:00" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="windowEnd">{t("campaigns.until")}</Label>
                  <Input id="windowEnd" name="windowEnd" type="time" defaultValue="18:00" min="08:00" max="21:00" required />
                </div>
                <fieldset className="space-y-1.5 sm:col-span-2">
                  <legend className="text-sm font-medium">{t("campaigns.days")}</legend>
                  <div className="flex flex-wrap gap-3">
                    {DAYS.map((d, i) => (
                      <label key={d} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="days" value={i} defaultChecked={i >= 1 && i <= 5} className="accent-[var(--primary)]" /> {d}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("campaigns.windowHelp")}</p>
                </fieldset>
                <div className="space-y-1.5">
                  <Label htmlFor="maxAttempts">{t("campaigns.maxAttempts")}</Label>
                  <Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={5} defaultValue={3} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="retryAfterMinutes">{t("campaigns.retryAfter")}</Label>
                  <Input id="retryAfterMinutes" name="retryAfterMinutes" type="number" min={30} max={10080} step={30} defaultValue={240} required />
                </div>
                <Button type="submit" className="sm:w-fit"><Plus /> {t("campaigns.create")}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
