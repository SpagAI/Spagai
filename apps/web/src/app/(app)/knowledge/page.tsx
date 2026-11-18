import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { requireOrg } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import type { KnowledgeRow } from "./actions";
import { KnowledgeManager } from "./knowledge-manager";

export const metadata: Metadata = { title: "Knowledge Base" };

/** Every agent's knowledge base in one place: choose an agent, then manage its knowledge. */
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const ctx = await requireOrg();
  const canEdit = can(ctx.role, "knowledge:edit");
  const { agent: wanted = "" } = await searchParams;
  const org = { organisationId: ctx.organisation.id };
  const [agents, counts] = await Promise.all([
    db.agent.findMany({ where: org, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.knowledgeItem.groupBy({ by: ["agentId"], where: org, _count: true }),
  ]);
  const agent = agents.find((a) => a.id === wanted) ?? agents[0];
  const items = agent ? await db.knowledgeItem.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "desc" } }) : [];
  const rows: KnowledgeRow[] = items.map((i) => ({
    id: i.id, kind: i.kind, name: i.name, url: i.url, sizeBytes: i.sizeBytes, pages: i.pages, chunks: i.chunks, contentChars: i.contentChars,
    status: i.status, error: i.error, createdAt: i.createdAt.toISOString(),
  }));
  const countOf = (id: string) => counts.find((c) => c.agentId === id)?._count ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Give your agents your documents and website, so they answer questions about your business correctly. You can also do this in each agent&apos;s Knowledge base tab.</p>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">Create an agent first</p>
          <p className="text-sm text-muted-foreground">Each agent has its own knowledge base.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Choose an agent">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/knowledge?agent=${a.id}`}
                role="tab"
                aria-selected={a.id === agent?.id}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors", a.id === agent?.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50 hover:bg-muted")}
              >
                {a.name}
                <span className={cn("rounded-full px-1.5 text-xs", a.id === agent?.id ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{countOf(a.id)}</span>
              </Link>
            ))}
          </div>
          {agent && <KnowledgeManager key={agent.id} agentId={agent.id} agentName={agent.name} initial={rows} canEdit={canEdit} />}
        </>
      )}
    </div>
  );
}
