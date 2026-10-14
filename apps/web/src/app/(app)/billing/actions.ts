"use server";

import { checkTopUp, parseNairaInput } from "@spagai/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { cancelTopUp, completeTopUp, startTopUp } from "@/server/wallet";

export async function topUp(form: FormData): Promise<void> {
  const ctx = await requirePermission("billing:manage");
  const amount = checkTopUp(parseNairaInput(z.string().max(30).catch("").parse(form.get("amount"))));
  if (!amount.ok) redirect(`/billing?error=${encodeURIComponent(amount.reason)}`);
  let next: string;
  try {
    next = await startTopUp({ organisationId: ctx.organisation.id, userId: ctx.user.id, email: ctx.user.email, amountKobo: amount.kobo });
  } catch (e) {
    console.error("Top-up could not be started:", e);
    redirect(`/billing?error=${encodeURIComponent("The payment could not be started. Please try again.")}`);
  }
  redirect(next);
}

/** The pretend checkout's "Pay" button. Only exists with PAYMENTS_PROVIDER=mock. */
export async function payMock(form: FormData): Promise<void> {
  const ctx = await requirePermission("billing:manage");
  if (env.PAYMENTS_PROVIDER !== "mock") redirect("/billing");
  const reference = z.string().min(1).max(100).parse(form.get("reference"));
  const pending = await db.walletTransaction.findFirst({ where: { reference, organisationId: ctx.organisation.id, type: "TOPUP" } });
  if (!pending) redirect("/billing?error=not-found");
  const result = await completeTopUp(reference, pending.amountKobo);
  revalidatePath("/billing");
  redirect(`/billing?${result === "credited" || result === "already_done" ? "paid=1" : `error=${result}`}`);
}

export async function cancelPayment(form: FormData): Promise<void> {
  const ctx = await requirePermission("billing:manage");
  const reference = z.string().min(1).max(100).parse(form.get("reference"));
  await cancelTopUp(ctx.organisation.id, reference);
  redirect("/billing?cancelled=1");
}
