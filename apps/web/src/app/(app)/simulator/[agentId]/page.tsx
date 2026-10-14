import { toLagosParts } from "@spagai/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Simulator } from "@/components/simulator/simulator";
import { requireOrg } from "@/server/auth/session";
import { loadAgent } from "@/server/agents";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Simulator" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function SimulatorPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const ctx = await requireOrg();
  const agent = await loadAgent(ctx.organisation.id, agentId);
  if (!agent) notFound();

  // Start the simulated clock at the current Lagos time.
  const p = toLagosParts(new Date());
  const now = `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;

  return <Simulator agentId={agent.id} config={agent.config} initialWhen={now} provider={env.LLM_PROVIDER} />;
}
