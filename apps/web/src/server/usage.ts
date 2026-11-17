import "server-only";
import { toLagosParts } from "@spagai/core";
import type { UsageKind } from "@/lib/usage-pricing";
import { db } from "./db";

/** Lagos calendar day, YYYY-MM-DD. */
export function lagosDay(now = new Date()): string {
  const p = toLagosParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Count usage of a paid service (for the Usage page; nothing is charged). Never throws, so a
 * counting problem can never break a test call.
 */
export async function recordUsage(organisationId: string, provider: string, amounts: Partial<Record<UsageKind, number>>): Promise<void> {
  const day = lagosDay();
  const rows = Object.entries(amounts).filter(([, q]) => typeof q === "number" && q > 0) as [UsageKind, number][];
  try {
    await Promise.all(
      rows.map(([kind, quantity]) =>
        db.providerUsage.upsert({
          where: { organisationId_day_kind_provider: { organisationId, day, kind, provider } },
          create: { organisationId, day, kind, provider, quantity: Math.round(quantity) },
          update: { quantity: { increment: Math.round(quantity) } },
        }),
      ),
    );
  } catch (e) {
    console.error("Usage not counted", e);
  }
}
