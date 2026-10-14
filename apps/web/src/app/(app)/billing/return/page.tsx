import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { confirmPaystackReturn } from "@/server/wallet";

/** Paystack sends the payer back here. We ask Paystack directly whether the payment succeeded. */
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await requirePermission("billing:view");
  const reference = z.string().min(1).max(100).safeParse(params.reference ?? params.trxref);
  if (!reference.success || env.PAYMENTS_PROVIDER !== "paystack") redirect("/billing");
  const owned = await db.walletTransaction.findFirst({ where: { reference: reference.data, organisationId: ctx.organisation.id } });
  if (!owned) redirect("/billing?error=not-found");
  const result = await confirmPaystackReturn(reference.data);
  redirect(result === "credited" || result === "already_done" ? "/billing?paid=1" : `/billing?error=${result}`);
}
