import { formatNaira, formatNigerianPhone, TOOL_DEFINITIONS, type SimMessage, type SimToolCall, type ToolId } from "@spagai/core";
import { ArrowLeft, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { CALL_STATUS_VARIANT } from "@/lib/status";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Call" };

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("call:view");
  const t = await getT();
  const call = await db.call.findFirst({
    where: { id, organisationId: ctx.organisation.id },
    include: { lead: true, campaign: { select: { id: true, name: true } }, agent: { select: { id: true, name: true } } },
  });
  if (!call) notFound();

  const transcript = (Array.isArray(call.transcript) ? call.transcript : []) as unknown as SimMessage[];
  const toolCalls = ((Array.isArray(call.toolCalls) ? call.toolCalls : []) as unknown as SimToolCall[]).filter((c) => c.tool in TOOL_DEFINITIONS);
  const reasons = (Array.isArray(call.blockReasons) ? call.blockReasons : []) as unknown as { code: string; message: string }[];
  const lead = call.lead;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href={call.campaign ? `/campaigns/${call.campaign.id}` : "/calls"}><ArrowLeft /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{[lead.title, lead.firstName, lead.lastName].filter(Boolean).join(" ")}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{formatNigerianPhone(lead.phone)}</span> · {formatLagos(call.attemptedAt)} WAT
            {call.campaign && <> · <Link className="underline-offset-2 hover:underline" href={`/campaigns/${call.campaign.id}`}>{call.campaign.name}</Link></>}
            {call.agent && <> · {call.agent.name}</>}
          </p>
        </div>
        <Badge variant={CALL_STATUS_VARIANT[call.status]}>{t(`calls.status.${call.status}`)}</Badge>
        {call.outcome && call.status !== "BLOCKED" && <Badge variant="outline">{t(`calls.outcome.${call.outcome}`)}</Badge>}
      </div>

      {call.provider === "mock" && call.status !== "BLOCKED" && <Alert>{t("calls.mockNote")}</Alert>}

      {reasons.length > 0 && (
        <Alert variant="destructive">
          <ShieldX />
          <p className="font-medium">{call.status === "BLOCKED" ? t("calls.blockedBecause") : t("calls.failedBecause")}</p>
          <ul className="list-disc space-y-0.5 pl-6">{reasons.map((r) => <li key={r.code + r.message}>{r.message}</li>)}</ul>
        </Alert>
      )}

      {call.status === "NO_ANSWER" && transcript.length === 0 && <Alert variant="warning">{t("calls.noAnswer")}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {transcript.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("calls.transcript")}</CardTitle>
              {call.durationSeconds ? <CardDescription>{t("calls.length")}: {Math.floor(call.durationSeconds / 60)}:{String(call.durationSeconds % 60).padStart(2, "0")}{call.costKobo ? ` · ${t("calls.cost")}: ${formatNaira(call.costKobo)}` : ""}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {transcript.map((m, i) =>
                m.role === "caller" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</p>
                  </div>
                ) : (
                  <p key={i} className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm">{m.text}</p>
                ),
              )}
            </CardContent>
          </Card>
        )}

        {toolCalls.length > 0 && (
          <Card className="h-fit">
            <CardHeader><CardTitle>{t("simulator.actions")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {toolCalls.map((c, i) => (
                <div key={i} className="rounded-md border p-2.5 text-sm">
                  <p className="font-medium">{TOOL_DEFINITIONS[c.tool as ToolId].name}</p>
                  <p className="break-words font-mono text-xs text-muted-foreground">
                    {Object.entries(c.args).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") || "—"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
