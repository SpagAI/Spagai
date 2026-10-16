import "server-only";
import { Prisma } from "@prisma/client";
import type { DashboardData, LocationRow } from "@/lib/dashboard-types";
import { db } from "./db";

/**
 * Dashboard figures for one workspace over the last `days` days (Lagos time, UTC+1),
 * plus the same figures for the period before, to show the change.
 */
export async function loadDashboard(organisationId: string, days: number): Promise<DashboardData> {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  const org = Prisma.sql`c."organisationId" = ${organisationId}`;
  const lagos = Prisma.sql`(c."attemptedAt" + interval '1 hour')`;

  const totals = (a: Date, b: Date) => db.$queryRaw<{ calls: bigint; answered: bigint; missed: bigint; booked: bigint; seconds: bigint | null; cost: bigint | null }[]>`
    SELECT count(*) FILTER (WHERE c.status <> 'BLOCKED' AND c.status <> 'FAILED') AS calls,
           count(*) FILTER (WHERE c.status = 'COMPLETED') AS answered,
           count(*) FILTER (WHERE c.status = 'NO_ANSWER') AS missed,
           count(*) FILTER (WHERE c.outcome = 'booked') AS booked,
           sum(c."durationSeconds") AS seconds,
           sum(c."costKobo") AS cost
    FROM "Call" c WHERE ${org} AND c."attemptedAt" >= ${a} AND c."attemptedAt" < ${b}`;

  const [cur, prev, daily, hours, durations, agents, locations] = await Promise.all([
    totals(from, now),
    totals(prevFrom, from),
    db.$queryRaw<{ day: Date; answered: bigint; missed: bigint; booked: bigint; cost: bigint | null; seconds: bigint | null }[]>`
      SELECT date_trunc('day', ${lagos}) AS day,
             count(*) FILTER (WHERE c.status = 'COMPLETED') AS answered,
             count(*) FILTER (WHERE c.status = 'NO_ANSWER') AS missed,
             count(*) FILTER (WHERE c.outcome = 'booked') AS booked,
             sum(c."costKobo") AS cost, sum(c."durationSeconds") AS seconds
      FROM "Call" c WHERE ${org} AND c."attemptedAt" >= ${from} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ hour: number; calls: bigint; answered: bigint }[]>`
      SELECT extract(hour FROM ${lagos})::int AS hour, count(*) AS calls, count(*) FILTER (WHERE c.status = 'COMPLETED') AS answered
      FROM "Call" c WHERE ${org} AND c."attemptedAt" >= ${from} AND c.status IN ('COMPLETED', 'NO_ANSWER') GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ bucket: number; calls: bigint }[]>`
      SELECT CASE WHEN c."durationSeconds" < 30 THEN 0 WHEN c."durationSeconds" < 60 THEN 1 WHEN c."durationSeconds" < 120 THEN 2
                  WHEN c."durationSeconds" < 300 THEN 3 ELSE 4 END AS bucket, count(*) AS calls
      FROM "Call" c WHERE ${org} AND c."attemptedAt" >= ${from} AND c.status = 'COMPLETED' GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ id: string; name: string; calls: bigint; answered: bigint; booked: bigint; seconds: bigint | null }[]>`
      SELECT a.id, a.name, count(*) AS calls, count(*) FILTER (WHERE c.status = 'COMPLETED') AS answered,
             count(*) FILTER (WHERE c.outcome = 'booked') AS booked, sum(c."durationSeconds") AS seconds
      FROM "Call" c JOIN "Agent" a ON a.id = c."agentId"
      WHERE ${org} AND c."attemptedAt" >= ${from} AND c.status IN ('COMPLETED', 'NO_ANSWER') GROUP BY a.id, a.name ORDER BY count(*) DESC`,
    db.$queryRaw<{ continent: string; country: string; countryCode: string; region: string; city: string; lat: number; lng: number; calls: bigint; answered: bigint }[]>`
      SELECT l.continent, l.country, l."countryCode", l.region, l.city, avg(l.lat) AS lat, avg(l.lng) AS lng,
             count(*) AS calls, count(*) FILTER (WHERE c.status = 'COMPLETED') AS answered
      FROM "Call" c JOIN "Lead" l ON l.id = c."leadId"
      WHERE ${org} AND c."attemptedAt" >= ${from} AND c.status IN ('COMPLETED', 'NO_ANSWER') AND l.city <> '' AND l.lat IS NOT NULL
      GROUP BY l.continent, l.country, l."countryCode", l.region, l.city ORDER BY count(*) DESC`,
  ]);

  const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
  const toTotals = (r: (typeof cur)[number] | undefined) => ({
    calls: n(r?.calls), answered: n(r?.answered), missed: n(r?.missed), booked: n(r?.booked),
    avgSeconds: n(r?.answered) ? Math.round(n(r?.seconds) / n(r?.answered)) : 0, costKobo: n(r?.cost),
  });

  // Every day in the range appears, even with no calls, so the chart has no gaps.
  const byDay = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), d]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() + 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
    const d = byDay.get(day);
    series.push({ day, answered: n(d?.answered), missed: n(d?.missed), booked: n(d?.booked), costKobo: n(d?.cost), avgSeconds: n(d?.answered) ? Math.round(n(d?.seconds) / n(d?.answered)) : 0 });
  }

  return {
    days,
    current: toTotals(cur[0]),
    previous: toTotals(prev[0]),
    series,
    hours: Array.from({ length: 24 }, (_, h) => { const r = hours.find((x) => x.hour === h); return { hour: h, calls: n(r?.calls), answered: n(r?.answered) }; }),
    durations: ["Under 30 s", "30–60 s", "1–2 min", "2–5 min", "Over 5 min"].map((label, i) => ({ label, calls: n(durations.find((d) => Number(d.bucket) === i)?.calls) })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, calls: n(a.calls), answered: n(a.answered), booked: n(a.booked), avgSeconds: n(a.answered) ? Math.round(n(a.seconds) / n(a.answered)) : 0 })),
    locations: locations.map((l): LocationRow => ({ continent: l.continent, country: l.country, countryCode: l.countryCode, region: l.region, city: l.city, lat: Number(l.lat), lng: Number(l.lng), calls: n(l.calls), answered: n(l.answered) })),
  };
}
