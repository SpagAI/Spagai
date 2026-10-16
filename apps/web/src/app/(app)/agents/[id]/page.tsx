import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentBuilder } from "@/components/agent-builder/builder";
import { formatNumber } from "@/lib/numbers";
import { requireOrg } from "@/server/auth/session";
import { loadAgent } from "@/server/agents";
import { db } from "@/server/db";
import { can } from "@/server/permissions";

export const metadata: Metadata = { title: "Agent Builder" };

export default async function AgentBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const ctx = await requireOrg();
  const agent = await loadAgent(ctx.organisation.id, id);
  if (!agent) notFound();
  const org = { organisationId: ctx.organisation.id };
  const [knowledge, numbers, free, tested, calls] = await Promise.all([
    db.knowledgeItem.findMany({ where: { ...org, agentId: agent.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, kind: true, status: true } }),
    db.phoneNumber.findMany({ where: { ...org, agentId: agent.id, status: "ACTIVE" }, select: { id: true, number: true, label: true } }),
    db.phoneNumber.findMany({ where: { ...org, agentId: null, status: "ACTIVE" }, select: { id: true, number: true, label: true } }),
    db.auditLog.count({ where: { ...org, action: "agent.tested", targetId: agent.id } }),
    db.call.count({ where: { ...org, agentId: agent.id } }),
  ]);
  const show = (n: { id: string; number: string; label: string }) => ({ ...n, number: formatNumber(n.number) });

  return (
    <AgentBuilder
      agentId={agent.id}
      initialConfig={agent.config}
      initialStatus={agent.status}
      updatedAt={agent.updatedAt.toISOString()}
      readOnly={!can(ctx.role, "agent:edit")}
      canDelete={can(ctx.role, "agent:delete")}
      isNew={isNew}
      connections={{
        knowledge,
        numbers: numbers.map(show),
        freeNumbers: free.map(show),
        canManageNumbers: can(ctx.role, "number:manage"),
        canEditKnowledge: can(ctx.role, "knowledge:edit"),
        testedInLab: tested + calls > 0,
      }}
    />
  );
}
