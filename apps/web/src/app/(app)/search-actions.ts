"use server";

import { formatNigerianPhone } from "@spagai/core";
import { z } from "zod";
import type { SearchHit } from "@/lib/shell-types";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";

/** Search agents, leads and campaigns in the signed-in organisation. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const ctx = await requirePermission("agent:view");
  const q = z.string().trim().min(2).max(60).safeParse(query);
  if (!q.success) return [];
  const org = { organisationId: ctx.organisation.id };
  const contains = { contains: q.data, mode: "insensitive" as const };
  const digits = q.data.replace(/\D/g, "").replace(/^0/, "");

  const [agents, leads, campaigns] = await Promise.all([
    db.agent.findMany({ where: { ...org, name: contains }, select: { id: true, name: true, status: true }, orderBy: { updatedAt: "desc" }, take: 4 }),
    db.lead.findMany({
      where: {
        ...org,
        OR: [{ firstName: contains }, { lastName: contains }, { source: contains }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, source: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.campaign.findMany({ where: { ...org, name: contains }, select: { id: true, name: true, status: true }, orderBy: { updatedAt: "desc" }, take: 4 }),
  ]);

  return [
    ...agents.map((a): SearchHit => ({ key: `agent-${a.id}`, group: "agents", label: a.name, sub: a.status === "READY" ? "Ready" : "Draft", href: `/agents/${a.id}` })),
    ...campaigns.map((c): SearchHit => ({ key: `campaign-${c.id}`, group: "campaigns", label: c.name, sub: c.status.charAt(0) + c.status.slice(1).toLowerCase(), href: `/campaigns/${c.id}` })),
    // Leads open the list filtered to that person, since there is no single-lead page yet.
    ...leads.map((l): SearchHit => ({
      key: `lead-${l.id}`,
      group: "leads",
      label: `${l.firstName} ${l.lastName}`.trim(),
      sub: `${formatNigerianPhone(l.phone)} · ${l.source}`,
      href: `/leads?q=${encodeURIComponent(l.phone.replace(/^\+234/, ""))}`,
    })),
  ];
}
