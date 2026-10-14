/**
 * Paystack helpers. The signature check and response reading are pure (tested);
 * the two network calls are thin wrappers around Paystack's documented REST API.
 * https://paystack.com/docs/api/transaction/  and  https://paystack.com/docs/payments/webhooks/
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.paystack.co";

/** Paystack signs each webhook body with HMAC-SHA512 using your secret key. */
export function isValidPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export interface PaidTransaction {
  reference: string;
  amountKobo: number;
}

/** A successful NGN charge, from a verify response or a "charge.success" webhook. Anything else → null. */
export function readSuccessfulCharge(data: unknown): PaidTransaction | null {
  const d = data as { status?: unknown; reference?: unknown; amount?: unknown; currency?: unknown } | null;
  if (!d || d.status !== "success" || d.currency !== "NGN") return null;
  if (typeof d.reference !== "string" || !Number.isSafeInteger(d.amount) || (d.amount as number) <= 0) return null;
  return { reference: d.reference, amountKobo: d.amount as number };
}

/** Start a payment. Returns the Paystack page to send the payer to. */
export async function initializePaystack(args: {
  secretKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
}): Promise<string> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { authorization: `Bearer ${args.secretKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      currency: "NGN",
      reference: args.reference,
      callback_url: args.callbackUrl,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; data?: { authorization_url?: string } } | null;
  if (!res.ok || !json?.status || !json.data?.authorization_url) throw new Error("Paystack could not start the payment.");
  return json.data.authorization_url;
}

/** Ask Paystack whether a payment really succeeded (never trust the browser's redirect alone). */
export async function verifyPaystack(secretKey: string, reference: string): Promise<PaidTransaction | null> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return readSuccessfulCharge(json?.data);
}
