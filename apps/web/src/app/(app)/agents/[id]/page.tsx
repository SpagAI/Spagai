import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentBuilder } from "@/components/agent-builder/builder";
import { requireOrg } from "@/server/auth/session";
import { loadAgent } from "@/server/agents";
import { can } from "@/server/permissions";

export const metadata: Metadata = { title: "Agent Builder" };

export default async function AgentBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const agent = await loadAgent(ctx.organisation.id, id);
  if (!agent) notFound();
  return (
    <AgentBuilder
      agentId={agent.id}
      initialConfig={agent.config}
      initialStatus={agent.status}
      updatedAt={agent.updatedAt.toISOString()}
      readOnly={!can(ctx.role, "agent:edit")}
      canDelete={can(ctx.role, "agent:delete")}
    />
  );
}
