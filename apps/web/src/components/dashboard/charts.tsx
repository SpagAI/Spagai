"use client";

import { ArrowDownRight, ArrowUpRight, Table2, BarChart3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { change, compact, mmss, naira, niceMax, type DashboardData, type DayPoint } from "@/lib/dashboard-types";

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

/* ───────────────────────── Stat tiles ───────────────────────── */

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 100, h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--chart-1)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  const pct = change(now, before);
  if (pct === null) return <span className="text-xs text-muted-foreground">No earlier data</span>;
  const up = pct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(pct)}%<span className="sr-only">{up ? " up" : " down"}</span>
      <span className="ml-1 font-normal text-muted-foreground">vs previous</span>
    </span>
  );
}

export function StatTiles({ data }: { data: DashboardData }) {
  const { current: c, previous: p, series } = data;
  const rate = (t: typeof c) => (t.calls ? Math.round((t.answered / t.calls) * 1000) / 10 : 0);
  const tiles = [
    { label: "Total calls", value: compact(c.calls), now: c.calls, before: p.calls, spark: series.map((d) => d.answered + d.missed) },
    { label: "Answered", value: `${rate(c)}%`, sub: `${compact(c.answered)} answered · ${compact(c.missed)} missed`, now: rate(c), before: rate(p), spark: series.map((d) => d.answered) },
    { label: "Avg. call duration", value: mmss(c.avgSeconds), now: c.avgSeconds, before: p.avgSeconds, spark: series.map((d) => d.avgSeconds) },
    { label: "Booked appointments", value: compact(c.booked), now: c.booked, before: p.booked, spark: series.map((d) => d.booked) },
    { label: "Call cost", value: naira(c.costKobo), now: c.costKobo, before: p.costKobo, spark: series.map((d) => d.costKobo), invert: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t, i) => (
        <div key={t.label} className={cn("flex flex-col gap-1 rounded-xl border bg-card p-4", i === 4 && "col-span-2 md:col-span-1")}>
          <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{t.value}</p>
          {t.sub ? <p className="text-xs text-muted-foreground tabular-nums">{t.sub}</p> : null}
          <Delta now={t.now} before={t.before} invert={t.invert} />
          <div className="mt-auto pt-2"><Sparkline values={t.spark} /></div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Shared pieces ───────────────────────── */

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, actions, children, className }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function ViewToggle({ table, onChange }: { table: boolean; onChange: (t: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!table)}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-pressed={table}
    >
      {table ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
      {table ? "Chart" : "Table"}
    </button>
  );
}

/** Horizontal gridlines with axis numbers on the left; children draw inside. */
function Plot({ max, height = 200, children }: { max: number; height?: number; children: React.ReactNode }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  return (
    <div className="flex gap-2" style={{ height }}>
      <div className="relative w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {ticks.map((v) => (
          <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (v / max) * 100}%` }}>{compact(v)}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        {ticks.map((v) => (
          <div key={v} className="absolute inset-x-0 h-px" style={{ top: `${100 - (v / max) * 100}%`, background: "var(--chart-grid)" }} aria-hidden />
        ))}
        {children}
      </div>
    </div>
  );
}

function Tip({ children, left }: { children: React.ReactNode; left: number }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute -top-2 z-10 w-max -translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{ left: `${left}%`, transform: `translate(${left > 70 ? "-100%" : left < 30 ? "0" : "-50%"}, -100%)` }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-[2px]" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-medium tabular-nums">{value}</span>
    </div>
  );
}

/* ───────────────────────── Calls over time ───────────────────────── */

export function CallsOverTime({ series }: { series: DayPoint[] }) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...series.map((d) => d.answered + d.missed), 1));
  const gap = series.length > 20 ? 2 : 6;
  const labelEvery = Math.ceil(series.length / 7);

  return (
    <ChartCard
      title="Calls over time"
      subtitle="Answered and missed calls per day (Lagos time)"
      className="lg:col-span-2"
      actions={<div className="flex items-center gap-3"><Legend items={[["Answered", "var(--chart-1)"], ["Missed", "var(--chart-2)"]]} /><ViewToggle table={table} onChange={setTable} /></div>}
    >
      {table ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="py-1.5 font-medium">Day</th><th className="text-right font-medium">Answered</th><th className="text-right font-medium">Missed</th><th className="text-right font-medium">Booked</th><th className="text-right font-medium">Cost</th></tr></thead>
            <tbody className="tabular-nums">
              {[...series].reverse().map((d) => (
                <tr key={d.day} className="border-t"><td className="py-1.5">{dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}</td><td className="text-right">{d.answered}</td><td className="text-right">{d.missed}</td><td className="text-right">{d.booked}</td><td className="text-right">{naira(d.costKobo)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <Plot max={max} height={220}>
            <div className="absolute inset-0 flex items-end" style={{ gap }} onMouseLeave={() => setHover(null)}>
              {series.map((d, i) => {
                const total = d.answered + d.missed;
                return (
                  <div key={d.day} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${dayLabel(d.day)}: ${d.answered} answered, ${d.missed} missed`}>
                    <div className={cn("absolute inset-y-0 -inset-x-px rounded-sm transition-colors", hover === i && "bg-muted/70")} aria-hidden />
                    <div className="relative flex flex-col gap-[2px]" style={{ height: `${(total / max) * 100}%` }}>
                      {d.missed > 0 && <div className="w-full rounded-t-[4px]" style={{ flex: d.missed, background: "var(--chart-2)" }} />}
                      {d.answered > 0 && <div className={cn("w-full", d.missed === 0 && "rounded-t-[4px]")} style={{ flex: d.answered, background: "var(--chart-1)" }} />}
                    </div>
                    {hover === i && (
                      <Tip left={50}>
                        <p className="mb-1 font-medium">{dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}</p>
                        <TipRow color="var(--chart-1)" label="Answered" value={String(d.answered)} />
                        <TipRow color="var(--chart-2)" label="Missed" value={String(d.missed)} />
                        <div className="mt-1 border-t pt-1 text-muted-foreground">{d.booked} booked · {naira(d.costKobo)}</div>
                      </Tip>
                    )}
                  </div>
                );
              })}
            </div>
          </Plot>
          <div className="ml-10 mt-2 flex text-[11px] text-muted-foreground" style={{ gap }}>
            {series.map((d, i) => (
              <span key={d.day} className="relative h-4 flex-1">
                {i % labelEvery === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{dayLabel(d.day)}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ───────────────────────── Busiest hours ───────────────────────── */

export function BusiestHours({ hours }: { hours: DashboardData["hours"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...hours.map((h) => h.calls), 1));
  const peak = hours.reduce((a, b) => (b.calls > a.calls ? b : a), { hour: 0, calls: 0, answered: 0 });
  const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <ChartCard title="Busiest hours" subtitle={peak.calls ? `Most calls at ${fmt(peak.hour)} (Lagos time)` : "No calls yet"}>
      <Plot max={max} height={150}>
        <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {hours.map((h) => (
            <div key={h.hour} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(h.hour)}>
              <div className={cn("absolute inset-y-0 -inset-x-px rounded-sm", hover === h.hour && "bg-muted/70")} aria-hidden />
              <div className="relative w-full rounded-t-[4px]" style={{ height: `${(h.calls / max) * 100}%`, background: "var(--chart-1)" }} />
              {hover === h.hour && (
                <Tip left={50}>
                  <p className="mb-1 font-medium">{fmt(h.hour)} – {fmt((h.hour + 1) % 24)}</p>
                  <TipRow color="var(--chart-1)" label="Calls" value={String(h.calls)} />
                  <div className="text-muted-foreground">{h.calls ? Math.round((h.answered / h.calls) * 100) : 0}% answered</div>
                </Tip>
              )}
            </div>
          ))}
        </div>
      </Plot>
      <div className="ml-10 flex justify-between text-[11px] text-muted-foreground"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
    </ChartCard>
  );
}

/* ───────────────────────── Call duration ───────────────────────── */

export function DurationChart({ durations, avgSeconds }: { durations: DashboardData["durations"]; avgSeconds: number }) {
  const total = durations.reduce((s, d) => s + d.calls, 0);
  const max = Math.max(...durations.map((d) => d.calls), 1);
  return (
    <ChartCard title="Call duration" subtitle={`Answered calls · average ${mmss(avgSeconds)}`}>
      <ul className="space-y-3">
        {durations.map((d) => (
          <li key={d.label} className="group grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-sm" title={`${d.label}: ${d.calls} calls`}>
            <span className="text-xs text-muted-foreground">{d.label}</span>
            <span className="h-3 overflow-hidden rounded-[4px] bg-muted/60">
              <span className="block h-full rounded-[4px] transition-opacity group-hover:opacity-80" style={{ width: `${(d.calls / max) * 100}%`, background: "var(--chart-1)" }} />
            </span>
            <span className="text-right text-xs tabular-nums">{total ? Math.round((d.calls / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ───────────────────────── Top agents ───────────────────────── */

export function TopAgents({ agents }: { agents: DashboardData["agents"] }) {
  const max = Math.max(...agents.map((a) => a.calls), 1);
  return (
    <ChartCard title="Top agents" subtitle="By calls placed in this period" className="h-full">
      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="pb-2 font-medium">Agent</th><th className="pb-2 text-right font-medium">Calls</th><th className="hidden pb-2 text-right font-medium sm:table-cell">Answered</th><th className="pb-2 text-right font-medium">Booked</th><th className="hidden pb-2 text-right font-medium sm:table-cell">Avg.</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {agents.slice(0, 6).map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2 pr-2">
                  <a href={`/agents/${a.id}`} className="font-medium hover:underline">{a.name}</a>
                  <span className="mt-1 block h-1.5 rounded-full" style={{ width: `${(a.calls / max) * 100}%`, background: "var(--chart-1)" }} aria-hidden />
                </td>
                <td className="text-right">{a.calls}</td>
                <td className="hidden text-right sm:table-cell">{a.calls ? Math.round((a.answered / a.calls) * 100) : 0}%</td>
                <td className="text-right">{a.booked}</td>
                <td className="hidden text-right sm:table-cell">{mmss(a.avgSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartCard>
  );
}

export { ChartCard, Legend, Tip, TipRow };
