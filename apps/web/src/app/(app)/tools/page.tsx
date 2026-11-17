import { ArrowRight, Lock, PhoneOff, Plus, Webhook, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_TOOLS, STARTERS } from "@/lib/custom-tools";
import type { McpToolInfo } from "@/lib/mcp";
import { McpManager } from "./mcp-manager";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";

export const metadata: Metadata = { title: "Tools" };

const ago = (d: Date) => {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

export default async function ToolsPage() {
  const ctx = await requireOrg();
  const org = ctx.organisation.id;
  const canManage = can(ctx.role, "integration:manage");
  const tools = await db.tool.findMany({ where: { organisationId: org }, orderBy: { createdAt: "desc" }, include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } });
  const agents = await db.agent.findMany({ where: { organisationId: org }, select: { config: true } });
  const mcpServers = await db.mcpServer.findMany({ where: { organisationId: org }, orderBy: { createdAt: "asc" } });
  const usedBy = (name: string) => agents.filter((a) => ((a.config as { customTools?: string[] }).customTools ?? []).includes(name)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Actions your agents can take during a call, such as booking a meeting in your calendar or adding a lead to your CRM. Each tool sends the details the agent collects to a webhook (Zapier, Make, n8n or your own system).
          </p>
        </div>
        {canManage && (
          <Link href="/tools/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> New tool
          </Link>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Default tools <span className="font-normal">· every agent has these; they cannot be changed</span></h2>
        <ul className="divide-y rounded-xl border bg-muted/20">
          {DEFAULT_TOOLS.map((t) => (
            <li key={t.name} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><PhoneOff className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.label}</span>
                <span className="block truncate text-xs text-muted-foreground"><code>{t.name}</code> · {t.description}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"><Lock className="size-3" /> Always on</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Your tools</h2>
        {tools.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Wrench className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 font-medium">No tools yet</p>
            <p className="text-sm text-muted-foreground">Start from one of the examples below, or build your own.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {tools.map((t) => {
              const last = t.runs[0];
              const n = usedBy(t.name);
              return (
                <li key={t.id}>
                  <Link href={`/tools/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Webhook className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <code>{t.name}</code> · {t.method} {new URL(t.url).host} · {n === 0 ? "not used by any agent" : `used by ${n} agent${n === 1 ? "" : "s"}`}
                      </span>
                    </span>
                    {last && (
                      <span className={`hidden shrink-0 text-xs sm:block ${last.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {last.ok ? "Worked" : "Failed"} {ago(last.createdAt)}
                      </span>
                    )}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">MCP servers <span className="font-normal">· connect a whole service (e.g. Make.com) and use its actions as tools</span></h2>
        <McpManager initial={mcpServers.map((m) => ({ id: m.id, name: m.name, label: m.label, host: m.urlHost, tools: (m.tools as unknown as McpToolInfo[]) ?? [], lastSyncedAt: m.lastSyncedAt?.toISOString() ?? null, lastError: m.lastError }))} canManage={canManage} />
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Start from an example</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(STARTERS).map(([key, s]) => (
              <Link key={key} href={`/tools/new?starter=${key}`} className="rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-muted/40">
                <p className="font-medium">{s.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Only owners and admins can create or change tools. You can switch tools on for an agent in its Tools tab.</p>
      )}
    </div>
  );
}
