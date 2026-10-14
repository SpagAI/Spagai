import "server-only";
import { randomBytes } from "node:crypto";
import { formatNaira } from "@spagai/core";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { initializePaystack, verifyPaystack } from "./payments/paystack";

/**
 * The prepaid wallet (M5). The balance only ever changes inside a database
 * transaction that also writes a WalletTransaction, so the history always adds up.
 */

export function newReference(prefix: "topup"): string {
  return `spag_${prefix}_${randomBytes(9).toString("base64url")}`;
}

/** Create a pending top-up and return where to send the payer. */
export async function startTopUp(args: { organisationId: string; userId: string; email: string; amountKobo: number }): Promise<string> {
  const reference = newReference("topup");
  await db.walletTransaction.create({
    data: {
      organisationId: args.organisationId,
      type: "TOPUP",
      status: "PENDING",
      amountKobo: args.amountKobo,
      reference,
      provider: env.PAYMENTS_PROVIDER,
      description: `Top-up of ${formatNaira(args.amountKobo)}`,
      createdById: args.userId,
    },
  });
  if (env.PAYMENTS_PROVIDER === "paystack") {
    return initializePaystack({
      secretKey: env.PAYSTACK_SECRET_KEY!,
      email: args.email,
      amountKobo: args.amountKobo,
      reference,
      callbackUrl: `${env.APP_URL}/billing/return`,
    });
  }
  return `/billing/checkout/${reference}`;
}

export type CompleteResult = "credited" | "already_done" | "not_found" | "amount_mismatch";

/**
 * Credit a paid top-up exactly once. Safe to call from the return page and the
 * webhook at the same time: only the first caller that flips PENDING → SUCCESS credits.
 */
export async function completeTopUp(reference: string, paidKobo: number): Promise<CompleteResult> {
  return db.$transaction(async (tx) => {
    const pending = await tx.walletTransaction.findUnique({ where: { reference } });
    if (!pending || pending.type !== "TOPUP") return "not_found";
    if (pending.status !== "PENDING") return "already_done";
    if (pending.amountKobo !== paidKobo) {
      await tx.walletTransaction.update({ where: { id: pending.id }, data: { status: "FAILED", completedAt: new Date(), description: `${pending.description} (amount did not match)` } });
      return "amount_mismatch";
    }
    const claimed = await tx.walletTransaction.updateMany({ where: { id: pending.id, status: "PENDING" }, data: { status: "SUCCESS", completedAt: new Date() } });
    if (claimed.count === 0) return "already_done";
    const org = await tx.organisation.update({ where: { id: pending.organisationId }, data: { balanceKobo: { increment: paidKobo } } });
    await tx.walletTransaction.update({ where: { id: pending.id }, data: { balanceAfterKobo: org.balanceKobo } });
    await tx.auditLog.create({
      data: { organisationId: org.id, actorUserId: pending.createdById, action: "wallet.topped_up", targetType: "wallet", targetId: pending.id, details: { amountKobo: paidKobo, provider: pending.provider } },
    });
    return "credited";
  });
}

export async function cancelTopUp(organisationId: string, reference: string): Promise<void> {
  await db.walletTransaction.updateMany({
    where: { organisationId, reference, type: "TOPUP", status: "PENDING" },
    data: { status: "FAILED", completedAt: new Date() },
  });
}

/** After Paystack sends the payer back: check with Paystack, then credit. */
export async function confirmPaystackReturn(reference: string): Promise<CompleteResult | "not_paid"> {
  const paid = await verifyPaystack(env.PAYSTACK_SECRET_KEY!, reference);
  if (!paid || paid.reference !== reference) return "not_paid";
  return completeTopUp(reference, paid.amountKobo);
}

/**
 * Take a call's cost from the wallet, inside the caller's transaction (so the call and
 * its charge are saved together). The call id makes the charge unique: it can never be taken twice.
 */
export async function chargeCall(
  tx: Prisma.TransactionClient,
  args: { organisationId: string; callId: string; costKobo: number; description: string },
): Promise<void> {
  if (args.costKobo <= 0) return;
  const org = await tx.organisation.update({ where: { id: args.organisationId }, data: { balanceKobo: { decrement: args.costKobo } } });
  await tx.walletTransaction.create({
    data: {
      organisationId: args.organisationId,
      type: "CALL_CHARGE",
      amountKobo: -args.costKobo,
      balanceAfterKobo: org.balanceKobo,
      reference: `spag_call_${args.callId}`,
      provider: "calls",
      callId: args.callId,
      description: args.description,
      completedAt: new Date(),
    },
  });
}
