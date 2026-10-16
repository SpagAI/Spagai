import type { Metadata } from "next";
import { INTEGRATIONS } from "@/lib/integrations";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { IntegrationCard } from "./integration-card";

export const metadata: Metadata = { title: "Integrations" };

const since = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(d);

export default async function IntegrationsPage() {
  const ctx = await requireOrg();
  const canManage = can(ctx.role, "integration:manage");
  const connected = await db.integration.findMany({ where: { organisationId: ctx.organisation.id } });
  const byProvider = new Map(connected.map((c) => [c.provider, { detail: c.detail, since: since(c.connectedAt) }]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">Send call results to the tools you already use, and let agents book straight into your calendar.</p>
        </div>
        <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{connected.length}</span> of {INTEGRATIONS.length} connected</p>
      </div>
      {!canManage && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Only owners and admins can connect or disconnect integrations.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((info) => (
          <IntegrationCard key={info.id} info={info} connected={byProvider.get(info.id) ?? null} canManage={canManage} />
        ))}
      </ul>
    </div>
  );
}
