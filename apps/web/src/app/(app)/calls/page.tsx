import { formatNigerianPhone } from "@spagai/core";
import { PhoneCall, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { CALL_STATUS_VARIANT } from "@/lib/status";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Calls" };

const FILTERS = ["ALL", "COMPLETED", "NO_ANSWER", "BLOCKED", "FAILED"] as const;

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await requirePermission("call:view");
  const t = await getT();
  const status = FILTERS.find((f) => f === params.status) ?? "ALL";
  const campaignId = params.campaign;

  const calls = await db.call.findMany({
    where: {
      organisationId: ctx.organisation.id,
      ...(status !== "ALL" && { status }),
      ...(campaignId && { campaignId }),
    },
    include: { lead: true, campaign: { select: { name: true } }, agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const href = (s: string) => `/calls?${new URLSearchParams({ ...(s !== "ALL" && { status: s }), ...(campaignId && { campaign: campaignId }) })}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("calls.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("calls.intro")}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f)}
            className={cn("rounded-md px-3 py-1.5 text-sm", status === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {f === "ALL" ? t("calls.all") : t(`calls.status.${f}`)}
          </Link>
        ))}
        {campaignId && <Link href={status === "ALL" ? "/calls" : `/calls?status=${status}`} className="px-3 py-1.5 text-sm underline">{t("calls.clearCampaign")}</Link>}
      </div>

      {calls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <PhoneCall className="size-8" />
            <p>{t("calls.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">{t("calls.when")}</th>
                  <th className="py-2 pr-3 font-medium">{t("leads.name")}</th>
                  <th className="py-2 pr-3 font-medium">{t("calls.campaign")}</th>
                  <th className="py-2 pr-3 font-medium">{t("calls.result")}</th>
                  <th className="py-2 font-medium">Recording</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap"><Link className="underline-offset-2 hover:underline" href={`/calls/${c.id}`}>{formatLagos(c.attemptedAt)}</Link></td>
                    <td className="py-2 pr-3">
                      {c.lead.firstName} {c.lead.lastName}
                      <span className="block font-mono text-[11px] text-muted-foreground">{formatNigerianPhone(c.lead.phone)}</span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{c.campaign?.name ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={CALL_STATUS_VARIANT[c.status]}>
                        {c.status === "BLOCKED" || c.status === "FAILED" ? t(`calls.status.${c.status}`) : t(`calls.outcome.${c.outcome ?? "other"}`)}
                      </Badge>
                    </td>
                    <td className="py-2 tabular-nums text-muted-foreground">
                      {c.durationSeconds ? (
                        <Link href={`/calls/${c.id}#recording`} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-accent" aria-label={`Listen to the recording (${Math.floor(c.durationSeconds / 60)}:${String(c.durationSeconds % 60).padStart(2, "0")})`}>
                          <Play className="size-3 fill-current text-primary" aria-hidden /> {Math.floor(c.durationSeconds / 60)}:{String(c.durationSeconds % 60).padStart(2, "0")}
                        </Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
