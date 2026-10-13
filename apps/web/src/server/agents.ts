import "server-only";
import { agentConfigSchema, type AgentConfig } from "@spagai/core";
import { db } from "./db";

/** Load an agent that belongs to the organisation, with its config checked. */
export async function loadAgent(organisationId: string, agentId: string) {
  const agent = await db.agent.findFirst({ where: { id: agentId, organisationId } });
  if (!agent) return null;
  const parsed = agentConfigSchema.safeParse(agent.config);
  if (!parsed.success) throw new Error(`Agent ${agent.id} has an invalid saved config.`);
  return { ...agent, config: parsed.data as AgentConfig };
}

export async function audit(
  organisationId: string,
  actorUserId: string | null,
  action: string,
  target?: { type: string; id: string },
  details?: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: {
      organisationId,
      actorUserId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      details: details === undefined ? undefined : (details as object),
    },
  });
}
