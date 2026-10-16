import { formatNaira, fromLagosParts, minutesCovered, toLagosParts } from "@spagai/core";
import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getT } from "@/i18n/server";
import { formatLagos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { can } from "@/server/permissions";
import { topUp } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const ERRORS: Record<string, string> = {
  "not-found": "That payment was not found.",
  amount_mismatch: "The amount paid did not match the top-up, so nothing was added. Contact support.",
  not_paid: "The payment was not completed, so nothing was added.",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await requirePermission("billing:view");
  // Test aid: a deliberate pause so the loading animation can be seen (development only, set in apps/web/.env).
  if (env.NODE_ENV === "development" && env.DEV_BILLING_DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, env.DEV_BILLING_DELAY_MS));
  }
  const t = await getT();
  const p = toLagosParts(new Date());
  const monthStart = fromLagosParts(p.year, p.month, 1);

  const [org, transactions, allTime, monthCalls] = await Promise.all([
    db.organisation.findUniqueOrThrow({ where: { id: ctx.organisation.id }, select: { balanceKobo: true, ratePerMinuteKobo: true } }),
    db.walletTransaction.findMany({ where: { organisationId: ctx.organisation.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    // Spending is counted from the calls themselves, so it always matches the dashboard.
    db.call.aggregate({ where: { organisationId: ctx.organisation.id, costKobo: { gt: 0 } }, _sum: { costKobo: true }, _count: true, _min: { attemptedAt: true } }),
    db.call.aggregate({ where: { organisationId: ctx.organisation.id, costKobo: { gt: 0 }, attemptedAt: { gte: monthStart } }, _sum: { costKobo: true }, _count: true }),
  ]);
  const totalSpent = allTime._sum.costKobo ?? 0;
  const spentThisMonth = monthCalls._sum.costKobo ?? 0;
  const minutesUsed = org.ratePerMinuteKobo ? Math.round(totalSpent / org.ratePerMinuteKobo) : 0;
  const since = allTime._min.attemptedAt;
  const canManage = can(ctx.role, "billing:manage");
  const error = params.error ? (ERRORS[params.error] ?? params.error) : null;
  const low = org.balanceKobo < org.ratePerMinuteKobo * 10;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("billing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("billing.intro")}</p>
      </div>

      {/* The headline figure: everything spent on calls so far. */}
      <section className="flex flex-wrap items-end justify-between gap-6 rounded-2xl border bg-foreground p-6 text-background sm:p-8">
        <div>
          <p className="text-sm font-medium opacity-80">Total spent</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{formatNaira(totalSpent)}</p>
          <p className="mt-2 text-sm opacity-80">
            {since ? `On about ${minutesUsed.toLocaleString("en")} minutes of answered calls since ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(since)}` : "No calls charged yet"}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="opacity-80">This month</dt><dd className="text-right font-semibold tabular-nums">{formatNaira(spentThisMonth)}</dd>
          <dt className="opacity-80">Charged calls</dt><dd className="text-right font-semibold tabular-nums">{allTime._count.toLocaleString("en")}</dd>
          <dt className="opacity-80">Balance left</dt><dd className="text-right font-semibold tabular-nums">{formatNaira(org.balanceKobo)}</dd>
        </dl>
      </section>

      {error && <Alert variant="destructive">{error}</Alert>}
      {params.paid && <Alert variant="success">{t("billing.paid")}</Alert>}
      {params.cancelled && <Alert>{t("billing.cancelled")}</Alert>}
      {env.PAYMENTS_PROVIDER === "mock" && <Alert>{t("billing.mockNote")}</Alert>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn(low && "border-warning/60")}>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5"><Wallet className="size-4" /> {t("billing.balance")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatNaira(org.balanceKobo)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("billing.covers").replace("{minutes}", String(minutesCovered(org.balanceKobo, org.ratePerMinuteKobo)))}
            {low && <p className="mt-1 font-medium text-foreground">{t("billing.low")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("billing.rate")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatNaira(org.ratePerMinuteKobo)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{t("billing.rateHelp")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("billing.thisMonth")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatNaira(spentThisMonth)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{t("billing.chargedCalls").replace("{count}", String(monthCalls._count))}</CardContent>
        </Card>
      </div>

      {canManage && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{t("billing.topUp")}</CardTitle>
            <CardDescription>{t("billing.topUpIntro")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[5_000, 20_000, 50_000].map((n) => (
                <form key={n} action={topUp}>
                  <input type="hidden" name="amount" value={n} />
                  <Button type="submit" variant="outline">{formatNaira(n * 100)}</Button>
                </form>
              ))}
            </div>
            <form action={topUp} className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="amount" className="sr-only">{t("billing.amount")}</Label>
                <Input id="amount" name="amount" inputMode="decimal" placeholder={t("billing.amountPlaceholder")} required maxLength={30} />
              </div>
              <Button type="submit">{t("billing.pay")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("billing.history")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("billing.empty")}</p>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">{t("calls.when")}</th>
                  <th className="py-2 pr-3 font-medium">{t("billing.what")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("billing.amount")}</th>
                  <th className="py-2 text-right font-medium">{t("billing.balanceAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatLagos(tx.createdAt)}</td>
                    <td className="py-2 pr-3">
                      {tx.callId ? <Link className="underline-offset-2 hover:underline" href={`/calls/${tx.callId}`}>{tx.description}</Link> : tx.description}
                      {tx.status !== "SUCCESS" && <Badge variant={tx.status === "PENDING" ? "warning" : "destructive"} className="ml-2">{t(`billing.status.${tx.status}`)}</Badge>}
                    </td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums", tx.amountKobo > 0 && tx.status === "SUCCESS" && "text-primary")}>
                      {tx.amountKobo > 0 ? "+" : ""}{formatNaira(tx.amountKobo)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{tx.balanceAfterKobo === null ? "—" : formatNaira(tx.balanceAfterKobo)}</td>
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
