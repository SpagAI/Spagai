import { Network, Phone, PhoneOff, Plus, Server } from "lucide-react";
import type { Metadata } from "next";
import { AutoSubmitSelect, ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryTag } from "@/components/country-tag";
import { formatNumber, TYPE_LABELS, type NumberType } from "@/lib/numbers";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { assignAgent, releaseNumber, removeSipTrunk } from "./actions";
import { BuyNumber, SipTrunkForm } from "./forms";

export const metadata: Metadata = { title: "Phone numbers" };

const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(d);

export default async function NumbersPage() {
  const ctx = await requireOrg();
  const canManage = can(ctx.role, "number:manage");
  const org = { organisationId: ctx.organisation.id };
  const [numbers, released, trunks, agents, callCounts] = await Promise.all([
    db.phoneNumber.findMany({ where: { ...org, status: "ACTIVE" }, orderBy: { purchasedAt: "asc" }, include: { agent: { select: { id: true, name: true } } } }),
    db.phoneNumber.findMany({ where: { ...org, status: "RELEASED" }, orderBy: { releasedAt: "desc" } }),
    db.sipTrunk.findMany({ where: org, orderBy: { createdAt: "asc" } }),
    db.agent.findMany({ where: org, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.call.groupBy({ by: ["agentId"], where: { ...org, attemptedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, _count: true }),
  ]);
  const monthly = numbers.reduce((s, n) => s + n.monthlyCostKobo, 0);
  const callsByAgent = new Map(callCounts.map((c) => [c.agentId, c._count]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Phone numbers</h1>
          <p className="text-sm text-muted-foreground">Numbers your agents call from and answer on. Buy one in seconds, or bring your own carrier.</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div><p className="text-xs text-muted-foreground">Active numbers</p><p className="text-xl font-semibold tabular-nums">{numbers.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Monthly cost</p><p className="text-xl font-semibold tabular-nums">₦{(monthly / 100).toLocaleString("en")}</p></div>
          <div><p className="text-xs text-muted-foreground">SIP trunks</p><p className="text-xl font-semibold tabular-nums">{trunks.length}</p></div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="size-5 text-primary" /> Your numbers</CardTitle>
          <CardDescription>Choose which agent handles each number. Changes take effect on the next call.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {numbers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No numbers yet. Buy one below or connect a SIP trunk.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="pb-2 font-medium">Number</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Assigned agent</th><th className="pb-2 text-right font-medium">Monthly</th><th className="pb-2 font-medium pl-4">Since</th><th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr key={n.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium tabular-nums"><CountryTag code={n.countryCode} />{formatNumber(n.number)}</p>
                      <p className="text-xs text-muted-foreground">{n.label || n.country}</p>
                    </td>
                    <td className="pr-3"><Badge variant="outline" className="font-normal">{TYPE_LABELS[n.type as NumberType] ?? n.type}</Badge></td>
                    <td className="pr-3 text-muted-foreground">{n.source === "Spag AI" ? "Bought on Spag AI" : <span className="inline-flex items-center gap-1"><Server className="size-3.5" />{n.source}</span>}</td>
                    <td className="pr-3">
                      <form action={assignAgent} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={n.id} />
                        <AutoSubmitSelect
                          name="agentId"
                          defaultValue={n.agentId ?? ""}
                          disabled={!canManage}
                          aria-label={`Agent for ${n.number}`}
                          className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                        >
                          <option value="">Not assigned</option>
                          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </AutoSubmitSelect>
                      </form>
                      {n.agentId && <p className="mt-1 text-xs text-muted-foreground">{callsByAgent.get(n.agentId) ?? 0} calls by this agent in 30 days</p>}
                    </td>
                    <td className="text-right tabular-nums">{n.monthlyCostKobo ? `₦${(n.monthlyCostKobo / 100).toLocaleString("en")}` : "Carrier"}</td>
                    <td className="pl-4 text-muted-foreground">{date(n.purchasedAt)}</td>
                    <td className="text-right">
                      {canManage && (
                        <form action={releaseNumber}>
                          <input type="hidden" name="id" value={n.id} />
                          <ConfirmButton variant="ghost" size="sm" className="text-destructive hover:text-destructive" confirm={`Release ${formatNumber(n.number)}? You may not be able to get this number back.`} pendingText="Releasing…">Release</ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" /> Buy a number</CardTitle>
            <CardDescription>Search by country and area code. Numbers are billed monthly from your credit.</CardDescription>
          </CardHeader>
          <CardContent><BuyNumber agents={agents} canManage={canManage} owned={numbers.map((n) => n.number)} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Network className="size-5 text-primary" /> Connect a SIP trunk</CardTitle>
            <CardDescription>Already have numbers with MTN, Airtel, Glo or another carrier? Connect them here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {trunks.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {trunks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className={`size-2 rounded-full ${t.status === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name} <span className="font-normal text-muted-foreground">· {t.status === "connected" ? "Connected" : "Unreachable"}</span></p>
                      <p className="truncate text-xs text-muted-foreground">{t.host}:{t.port} · {t.transport.toUpperCase()}{t.username ? ` · ${t.username}` : ""}{t.hasPassword ? " · password set" : ""}</p>
                    </div>
                    {canManage && (
                      <form action={removeSipTrunk}>
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmButton variant="ghost" size="sm" confirm={`Disconnect ${t.name}? Its numbers will be released.`}>Disconnect</ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <SipTrunkForm canManage={canManage} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PhoneOff className="size-5 text-muted-foreground" /> Released numbers</CardTitle>
          <CardDescription>Numbers you no longer use. They are no longer billed.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {released.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing released yet.</p>
          ) : (
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="pb-2 font-medium">Number</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Had it from</th><th className="pb-2 font-medium">Released</th></tr></thead>
              <tbody className="text-muted-foreground">
                {released.map((n) => (
                  <tr key={n.id} className="border-b last:border-0">
                    <td className="py-2.5 tabular-nums"><CountryTag code={n.countryCode} /><span className="line-through decoration-muted-foreground/50">{formatNumber(n.number)}</span></td>
                    <td>{TYPE_LABELS[n.type as NumberType] ?? n.type}</td>
                    <td>{date(n.purchasedAt)}</td>
                    <td>{n.releasedAt ? date(n.releasedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
