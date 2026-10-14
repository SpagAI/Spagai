import { formatNaira } from "@spagai/core";
import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { cancelPayment, payMock } from "../../actions";

export const metadata: Metadata = { title: "Pretend checkout" };

/** A pretend payment page, so top-ups can be tried without a payment account. Never shown with a real provider. */
export default async function MockCheckout({ params }: { params: Promise<{ reference: string }> }) {
  if (env.PAYMENTS_PROVIDER !== "mock") notFound();
  const { reference } = await params;
  const ctx = await requirePermission("billing:manage");
  const t = await getT();
  const pending = await db.walletTransaction.findFirst({ where: { reference, organisationId: ctx.organisation.id, type: "TOPUP" } });
  if (!pending) notFound();
  if (pending.status !== "PENDING") redirect("/billing");

  return (
    <div className="mx-auto max-w-md space-y-4 pt-6">
      <Alert variant="warning">{t("billing.mockCheckoutWarning")}</Alert>
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5"><CreditCard className="size-4" /> {t("billing.mockCheckout")}</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatNaira(pending.amountKobo)}</CardTitle>
          <CardDescription>{ctx.organisation.name} · {t("billing.reference")} {pending.reference}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={payMock}>
            <input type="hidden" name="reference" value={pending.reference} />
            <Button type="submit">{t("billing.mockPay")}</Button>
          </form>
          <form action={cancelPayment}>
            <input type="hidden" name="reference" value={pending.reference} />
            <Button type="submit" variant="ghost">{t("common.cancel")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
