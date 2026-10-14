import { env } from "@/server/env";
import { isValidPaystackSignature, readSuccessfulCharge } from "@/server/payments/paystack";
import { completeTopUp } from "@/server/wallet";

/**
 * Paystack webhook. Set this URL in the Paystack dashboard: <APP_URL>/api/webhooks/paystack
 * Every request must carry a valid signature. Crediting is idempotent (see completeTopUp).
 */
export async function POST(request: Request): Promise<Response> {
  if (env.PAYMENTS_PROVIDER !== "paystack" || !env.PAYSTACK_SECRET_KEY) return new Response("Not enabled", { status: 404 });
  const raw = await request.text();
  if (raw.length > 100_000) return new Response("Too large", { status: 413 });
  if (!isValidPaystackSignature(raw, request.headers.get("x-paystack-signature"), env.PAYSTACK_SECRET_KEY)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: unknown };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (event.event === "charge.success") {
    const paid = readSuccessfulCharge(event.data);
    if (paid) await completeTopUp(paid.reference, paid.amountKobo);
  }
  // Always 200 for valid, signed events, so Paystack does not keep retrying ones we ignore.
  return new Response("OK", { status: 200 });
}
