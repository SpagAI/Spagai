import "server-only";
import { randomUUID } from "node:crypto";
import {
  agentConfigSchema,
  billableMinutes,
  callCostKobo,
  canAffordCall,
  formatNaira,
  buildCallValues,
  checkCallAttempt,
  compilePrompt,
  fromLagosParts,
  parseHHMM,
  pickPersona,
  runMockCall,
  type Block,
  type CallOutcome,
  type Weekday,
} from "@spagai/core";
import type { Prisma } from "@prisma/client";
import { audit } from "./agents";
import { db } from "./db";
import { chargeCall } from "./wallet";

/**
 * The campaign dialler (M4). For each lead that is due:
 *   1. ask the compliance gate (and record a BLOCKED call with the reasons if it says no),
 *   2. place the call (mock telephony for now),
 *   3. act on the outcome: opt-outs go on the do-not-call list at once, callbacks
 *      and unanswered calls are scheduled for later, finished leads are closed.
 */

export interface BatchSummary {
  attempted: number;
  blocked: number;
  completed: number;
  noAnswer: number;
  failed: number;
  /** Total charged to the wallet in this batch, in kobo. */
  chargedKobo: number;
  /** Set when the batch stopped early (e.g. outside calling hours). */
  stoppedBecause: string | null;
  finished: boolean;
}

const FINAL_OUTCOMES: CallOutcome[] = ["booked", "not_interested", "wrong_number", "opted_out", "other"];

export async function runCampaignBatch(args: {
  organisationId: string;
  actorUserId: string;
  campaignId: string;
  now: Date;
  limit: number;
}): Promise<BatchSummary> {
  const { organisationId, actorUserId, campaignId, now, limit } = args;
  const summary: BatchSummary = { attempted: 0, blocked: 0, completed: 0, noAnswer: 0, failed: 0, chargedKobo: 0, stoppedBecause: null, finished: false };

  const campaign = await db.campaign.findFirst({ where: { id: campaignId, organisationId }, include: { agent: true } });
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.status !== "RUNNING") {
    summary.stoppedBecause = "The campaign is not running. Press Start first.";
    return summary;
  }

  const config = agentConfigSchema.parse(campaign.agent.config);
  const window = { start: campaign.windowStart, end: campaign.windowEnd, days: campaign.days as Weekday[] };
  const doNotCall = new Set(
    (await db.doNotCall.findMany({ where: { organisationId }, select: { phone: true } })).map((d) => d.phone),
  );

  const due = await db.campaignLead.findMany({
    where: { campaignId, status: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    include: { lead: true },
    orderBy: [{ attempts: "asc" }, { id: "asc" }],
    take: limit,
  });

  for (const cl of due) {
    const { lead } = cl;
    const gate = checkCallAttempt({
      now,
      agentReady: campaign.agent.status === "READY",
      lead: { phone: lead.phone, optedOut: lead.optedOut, consent: lead.consent, source: lead.source },
      doNotCall,
      campaignWindow: window,
      attempts: cl.attempts,
      maxAttempts: campaign.maxAttempts,
      lastAttemptAt: cl.lastAttemptAt,
      retryAfterMinutes: campaign.retryAfterMinutes,
    });

    if (!gate.allowed && gate.blocks.every((b) => b.code === "too_soon") && cl.lastAttemptAt) {
      // Not a refusal, just early: schedule it instead of logging a block every batch.
      await db.campaignLead.update({
        where: { id: cl.id },
        data: { nextAttemptAt: new Date(cl.lastAttemptAt.getTime() + campaign.retryAfterMinutes * 60_000) },
      });
      continue;
    }

    if (!gate.allowed) {
      await recordBlocked({ organisationId, actorUserId, campaignId, agentId: campaign.agentId, leadId: lead.id, campaignLeadId: cl.id, blocks: gate.blocks, now });
      summary.blocked++;
      // Calling hours or an unready agent affect every lead: stop instead of logging the same block many times.
      const global = gate.blocks.find((b) => b.code === "outside_calling_hours" || b.code === "agent_not_ready");
      if (global) {
        summary.stoppedBecause = global.message;
        break;
      }
      continue;
    }

    // Prepaid: a call only starts when the wallet covers at least one minute.
    const wallet = await db.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { balanceKobo: true, ratePerMinuteKobo: true } });
    if (!canAffordCall(wallet.balanceKobo, wallet.ratePerMinuteKobo)) {
      summary.stoppedBecause = `Not enough balance (${formatNaira(wallet.balanceKobo)}). Each call needs at least ${formatNaira(wallet.ratePerMinuteKobo)}. Top up on the Billing page.`;
      break;
    }

    summary.attempted++;
    const values: Record<string, string> = {
      lead_source: lead.source,
      ...stringValues(lead.extra),
      ...buildCallValues(
        { title: lead.title, gender: lead.gender, firstName: lead.firstName, lastName: lead.lastName, ...stringValues(lead.extra) },
        now,
        config.addressMode,
      ),
      ...config.variableValues,
    };
    const compiled = compilePrompt(
      { blocks: config.blocks, variables: config.variables, firstMessage: config.firstMessage },
      { values, mode: "call" },
    );
    if (compiled.errors.length) {
      // Missing per-call values (e.g. amount_due) for this lead: a data problem, not a compliance one.
      await db.$transaction([
        db.call.create({
          data: {
            organisationId, campaignId, leadId: lead.id, agentId: campaign.agentId, status: "FAILED", attemptedAt: now,
            outcome: "other", blockReasons: compiled.errors.map((message) => ({ code: "missing_value", message, permanent: true })),
          },
        }),
        db.campaignLead.update({ where: { id: cl.id }, data: { status: "STOPPED", outcome: "missing_data", attempts: { increment: 1 }, lastAttemptAt: now } }),
      ]);
      summary.failed++;
      continue;
    }

    const result = runMockCall({
      persona: pickPersona(`${lead.id}:${cl.attempts}`),
      firstMessage: compiled.firstMessage,
      values,
      tools: config.tools,
      silence: config.silence,
      now,
    });

    const attempts = cl.attempts + 1;
    let status: "PENDING" | "DONE" | "STOPPED" = "PENDING";
    let nextAttemptAt: Date | null = null;
    if (result.outcome === "opted_out") status = "STOPPED";
    else if (FINAL_OUTCOMES.includes(result.outcome)) status = "DONE";
    else if (result.outcome === "callback" && result.callback) {
      const [y, m, d] = result.callback.date.split("-").map(Number) as [number, number, number];
      const minutes = parseHHMM(result.callback.time);
      nextAttemptAt = fromLagosParts(y, m, d, Math.floor(minutes / 60), minutes % 60);
    } else nextAttemptAt = new Date(now.getTime() + campaign.retryAfterMinutes * 60_000);
    if (status === "PENDING" && attempts >= campaign.maxAttempts) status = "DONE";

    const callId = randomUUID();
    const costKobo = result.answered ? callCostKobo(result.durationSeconds, wallet.ratePerMinuteKobo) : 0;
    // The call, the lead's progress, any opt-out and the charge are saved together or not at all.
    await db.$transaction(async (tx) => {
      await tx.call.create({
        data: {
          id: callId,
          organisationId, campaignId, leadId: lead.id, agentId: campaign.agentId,
          status: result.answered ? "COMPLETED" : "NO_ANSWER",
          outcome: result.outcome,
          transcript: result.transcript as unknown as Prisma.InputJsonValue,
          toolCalls: result.toolCalls as unknown as Prisma.InputJsonValue,
          durationSeconds: result.durationSeconds,
          costKobo: costKobo || null,
          provider: "mock",
          attemptedAt: now,
        },
      });
      await tx.campaignLead.update({
        where: { id: cl.id },
        data: { status, attempts, lastAttemptAt: now, nextAttemptAt, outcome: result.outcome },
      });
      if (result.optedOut) {
        // Opt-outs take effect immediately, for every campaign.
        await tx.lead.update({ where: { id: lead.id }, data: { optedOut: true, optedOutAt: now } });
        await tx.doNotCall.upsert({
          where: { organisationId_phone: { organisationId, phone: lead.phone } },
          create: { organisationId, phone: lead.phone, reason: "opt_out", note: `Asked on a call (campaign "${campaign.name}").` },
          update: {},
        });
      }
      await chargeCall(tx, {
        organisationId,
        callId,
        costKobo,
        description: `Call to ${lead.firstName} ${lead.lastName}`.trim() + ` (${billableMinutes(result.durationSeconds)} min)`,
      });
    });
    if (result.optedOut) doNotCall.add(lead.phone);
    summary.chargedKobo += costKobo;
    if (result.optedOut) await audit(organisationId, actorUserId, "lead.opted_out", { type: "lead", id: lead.id }, { campaignId });
    if (result.answered) summary.completed++;
    else summary.noAnswer++;
  }

  const remaining = await db.campaignLead.count({ where: { campaignId, status: "PENDING" } });
  if (remaining === 0) {
    await db.campaign.update({ where: { id: campaignId }, data: { status: "COMPLETED" } });
    summary.finished = true;
  }
  await audit(organisationId, actorUserId, "campaign.batch", { type: "campaign", id: campaignId }, { ...summary, at: now.toISOString() });
  return summary;
}

async function recordBlocked(args: {
  organisationId: string;
  actorUserId: string;
  campaignId: string;
  agentId: string;
  leadId: string;
  campaignLeadId: string;
  blocks: Block[];
  now: Date;
}) {
  const permanent = args.blocks.some((b) => b.permanent);
  await db.$transaction([
    db.call.create({
      data: {
        organisationId: args.organisationId,
        campaignId: args.campaignId,
        leadId: args.leadId,
        agentId: args.agentId,
        status: "BLOCKED",
        blockReasons: args.blocks as unknown as Prisma.InputJsonValue,
        attemptedAt: args.now,
      },
    }),
    ...(permanent
      ? [db.campaignLead.update({ where: { id: args.campaignLeadId }, data: { status: "STOPPED" as const, outcome: "blocked" } })]
      : []),
  ]);
}

function stringValues(json: Prisma.JsonValue): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(Object.entries(json).filter((e): e is [string, string] => typeof e[1] === "string"));
}
