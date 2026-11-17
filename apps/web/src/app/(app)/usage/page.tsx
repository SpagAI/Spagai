import { AudioLines, Brain, Ear, ExternalLink, Info } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd, NAIRA_PER_USD, summarise, type UsageKind, type UsageTotals } from "@/lib/usage-pricing";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { fishCreditLeft } from "@/server/providers/fish-audio";
import { lagosDay } from "@/server/usage";

export const metadata: Metadata = { title: "Usage" };

const naira = (usd: number) => (usd > 0 && usd * NAIRA_PER_USD < 1 ? "less than ₦1" : `≈ ₦${Math.round(usd * NAIRA_PER_USD).toLocaleString("en-NG")}`);
const plural = (count: number, word: string) => `${Math.round(count).toLocaleString("en-NG")} ${word}${Math.round(count) === 1 ? "" : "s"}`;
const n = (x: number) => Math.round(x).toLocaleString("en-NG");

function totalsOf(rows: { kind: string; quantity: number }[]): UsageTotals {
  const t: UsageTotals = {};
  for (const r of rows) t[r.kind as UsageKind] = (t[r.kind as UsageKind] ?? 0) + r.quantity;
  return t;
}

const dayLabel = (day: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** What testing uses at the paid services, and roughly what it costs. Nothing here is charged. */
export default async function UsagePage() {
  const ctx = await requirePermission("billing:view");
  const today = lagosDay();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await db.providerUsage.findMany({ where: { organisationId: ctx.organisation.id, day: { gte: monthStart } }, select: { day: true, kind: true, quantity: true } });
  const month = summarise(totalsOf(rows));
  const todays = summarise(totalsOf(rows.filter((r) => r.day === today)));
  const days = [...new Set(rows.map((r) => r.day))].sort().reverse();
  const fishLeft = await fishCreditLeft();
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthStart}T12:00:00Z`));

  const groups = [
    { icon: Brain, title: "AI brain", who: "Groq", usd: month.ai.usd, main: plural(month.ai.replies, "reply").replace("replys", "replies"), detail: `${n(month.ai.tokensIn)} tokens read · ${n(month.ai.tokensOut)} written` },
    { icon: AudioLines, title: "Voice", who: "Fish Audio", usd: month.voice.usd, main: `${n(month.voice.characters)} characters spoken`, detail: "$15 per million characters" },
    { icon: Ear, title: "Listening", who: "Groq Whisper", usd: month.listening.usd, main: `${month.listening.minutes.toFixed(1)} minutes of speech`, detail: "$0.111 per hour (10 s minimum per recording)" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground">What testing your agents uses at the paid services behind the studio, and roughly what it costs you. Nothing here is taken from your credit.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardDescription>{monthName} so far</CardDescription></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{formatUsd(month.totalUsd)}</p>
            <p className="text-sm text-muted-foreground">{naira(month.totalUsd)} · estimated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Today</CardDescription></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{formatUsd(todays.totalUsd)}</p>
            <p className="text-sm text-muted-foreground">{naira(todays.totalUsd)} · {plural(todays.ai.replies, "AI reply").replace("replys", "replies")} today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><g.icon className="size-4 text-primary" /> {g.title}</CardTitle>
              <CardDescription>{g.who}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold tabular-nums">{formatUsd(g.usd)}</p>
              <p className="text-sm">{g.main}</p>
              <p className="text-xs text-muted-foreground">{g.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balances at the providers</CardTitle>
          <CardDescription>Where the real bills come from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <span><span className="font-medium">Fish Audio</span> (voice): {fishLeft === null ? "balance not available" : <><span className="font-semibold">${fishLeft.toFixed(2)}</span> of credit left, about {n(fishLeft / (15 / 1_000_000))} more characters</>}</span>
            <a href="https://fish.audio" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Top up <ExternalLink className="size-3.5" /></a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <span><span className="font-medium">Groq</span> (AI brain and listening): billed monthly for what you use; see usage and plan in the Groq console.</span>
            <a href="https://console.groq.com/settings/billing" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open Groq <ExternalLink className="size-3.5" /></a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Day by day</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {days.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No usage counted yet this month. Talk to an agent and it will show up here.</p> : (
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 font-medium">Day</th><th className="font-medium">AI replies</th><th className="font-medium">Voice characters</th><th className="font-medium">Listening</th><th className="text-right font-medium">Cost</th></tr>
              </thead>
              <tbody className="divide-y">
                {days.map((day) => {
                  const d = summarise(totalsOf(rows.filter((r) => r.day === day)));
                  return (
                    <tr key={day}>
                      <td className="py-2">{dayLabel(day)}</td>
                      <td>{n(d.ai.replies)}</td>
                      <td>{n(d.voice.characters)}</td>
                      <td>{d.listening.minutes.toFixed(1)} min</td>
                      <td className="text-right tabular-nums">{formatUsd(d.totalUsd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Estimates from the providers&apos; published prices (Groq gpt-oss-120b: $0.15 per million tokens read, $0.60 per million written; Fish Audio: $15 per million characters; Groq Whisper: $0.111 per hour). Naira at about ₦{NAIRA_PER_USD.toLocaleString("en-NG")} per $1. Counting started on 17 November 2026; earlier use is not included. On the free Groq plan, AI and listening cost nothing until you upgrade.
      </p>
    </div>
  );
}
