import { BookOpen, FileText, Globe, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fileSize } from "@/lib/file-size";
import { cn } from "@/lib/utils";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { deleteKnowledge } from "./actions";
import { AddWebsite, RefreshWhileProcessing, UploadFiles } from "./forms";

export const metadata: Metadata = { title: "Knowledge Base" };

/** How long the (simulated) reading of a file or website takes. */
const PROCESSING_MS = 6000;

const date = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(d);

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ agent?: string; kind?: string }> }) {
  const ctx = await requireOrg();
  const canEdit = can(ctx.role, "knowledge:edit");
  const { agent: agentFilter = "", kind = "" } = await searchParams;
  const org = { organisationId: ctx.organisation.id };

  // Simulated reading: anything added more than a few seconds ago is ready.
  await db.knowledgeItem.updateMany({ where: { ...org, status: "PROCESSING", createdAt: { lt: new Date(Date.now() - PROCESSING_MS) } }, data: { status: "READY" } });

  const [agents, all] = await Promise.all([
    db.agent.findMany({ where: org, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.knowledgeItem.findMany({ where: org, orderBy: { createdAt: "desc" }, include: { agent: { select: { id: true, name: true } } } }),
  ]);
  const items = all.filter((i) => (!agentFilter || i.agentId === agentFilter) && (!kind || i.kind === kind));
  const processing = all.some((i) => i.status === "PROCESSING");
  const href = (next: { agent?: string; kind?: string }) => {
    const p = new URLSearchParams({ ...(agentFilter && { agent: agentFilter }), ...(kind && { kind }), ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/knowledge${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <RefreshWhileProcessing active={processing} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Give your agents your documents and website, so they answer questions about your business correctly.</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div><p className="text-xs text-muted-foreground">Files</p><p className="text-xl font-semibold tabular-nums">{all.filter((i) => i.kind === "FILE").length}</p></div>
          <div><p className="text-xs text-muted-foreground">Websites</p><p className="text-xl font-semibold tabular-nums">{all.filter((i) => i.kind === "WEBSITE").length}</p></div>
          <div><p className="text-xs text-muted-foreground">Searchable pieces</p><p className="text-xl font-semibold tabular-nums">{all.reduce((s, i) => s + i.chunks, 0).toLocaleString("en")}</p></div>
        </div>
      </div>

      {canEdit && agents.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" /> Upload files</CardTitle>
              <CardDescription>Price lists, brochures, FAQs, policies and product sheets.</CardDescription>
            </CardHeader>
            <CardContent><UploadFiles agents={agents} defaultAgent={agentFilter || undefined} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="size-5 text-primary" /> Add a website</CardTitle>
              <CardDescription>We read the pages and keep the text up to date every week.</CardDescription>
            </CardHeader>
            <CardContent><AddWebsite agents={agents} defaultAgent={agentFilter || undefined} /></CardContent>
          </Card>
        </div>
      )}
      {agents.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Create an agent first, then come back to give it knowledge. <Link href="/agents/new" className="font-medium text-primary hover:underline">Create an agent</Link>
        </p>
      )}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" /> Your knowledge</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <nav aria-label="Type" className="inline-flex rounded-lg border p-0.5">
                {[["", "All"], ["FILE", "Files"], ["WEBSITE", "Websites"]].map(([value, label]) => (
                  <Link key={value} href={href({ kind: value })} aria-current={kind === value ? "page" : undefined} className={cn("rounded-md px-2.5 py-1 text-xs", kind === value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>{label}</Link>
                ))}
              </nav>
              <nav aria-label="Agent" className="flex flex-wrap gap-1">
                <Link href={href({ agent: "" })} className={cn("rounded-full border px-2.5 py-1 text-xs", !agentFilter ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground")}>All agents</Link>
                {agents.map((a) => (
                  <Link key={a.id} href={href({ agent: a.id })} className={cn("rounded-full border px-2.5 py-1 text-xs", agentFilter === a.id ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground")}>{a.name}</Link>
                ))}
              </nav>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <table className="w-full min-w-[680px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Agent</th><th className="pb-2 font-medium">Size</th><th className="pb-2 text-right font-medium">Pieces</th><th className="pb-2 pl-4 font-medium">Status</th><th className="pb-2 font-medium">Added</th><th className="pb-2" /></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="max-w-72 py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">{i.kind === "FILE" ? <FileText className="size-4" /> : <Globe className="size-4" />}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{i.name}</p>
                          {i.kind === "WEBSITE" ? <a href={i.url} target="_blank" rel="noreferrer noopener" className="block truncate text-xs text-muted-foreground hover:underline">{i.url}</a> : <p className="text-xs text-muted-foreground">{i.name.split(".").pop()?.toUpperCase()} file</p>}
                        </div>
                      </div>
                    </td>
                    <td className="pr-3"><Link href={`/agents/${i.agent.id}`} className="hover:underline">{i.agent.name}</Link></td>
                    <td className="pr-3 tabular-nums text-muted-foreground">{i.kind === "FILE" ? fileSize(i.sizeBytes) : `${i.pages} page${i.pages === 1 ? "" : "s"}`}</td>
                    <td className="text-right tabular-nums">{i.status === "READY" ? i.chunks : "—"}</td>
                    <td className="pl-4 pr-3">
                      {i.status === "READY" ? <Badge variant="outline" className="border-emerald-500/40 font-normal text-emerald-700 dark:text-emerald-400">Ready</Badge>
                        : i.status === "PROCESSING" ? <Badge variant="outline" className="gap-1 font-normal"><Loader2 className="size-3 animate-spin" /> Reading…</Badge>
                        : <Badge variant="destructive" className="font-normal">Failed</Badge>}
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{date(i.createdAt)}</td>
                    <td className="text-right">
                      {canEdit && (
                        <form action={deleteKnowledge}>
                          <input type="hidden" name="id" value={i.id} />
                          <ConfirmButton variant="ghost" size="sm" className="text-destructive hover:text-destructive" confirm={`Delete ${i.name}? ${i.agent.name} will no longer use it.`} pendingText="Deleting…">Delete</ConfirmButton>
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
    </div>
  );
}
