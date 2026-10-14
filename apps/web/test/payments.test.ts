import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidPaystackSignature, readSuccessfulCharge } from "@/server/payments/paystack";
import { isWorkerAuthorised } from "@/server/worker-auth";

const SECRET = "sk_test_example_secret";
const sign = (body: string, key = SECRET) => createHmac("sha512", key).update(body).digest("hex");

describe("isValidPaystackSignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "spag_topup_x" } });

  it("accepts Paystack's HMAC-SHA512 signature", () => {
    expect(isValidPaystackSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a changed body, a wrong key, or a missing or malformed signature", () => {
    expect(isValidPaystackSignature(body + " ", sign(body), SECRET)).toBe(false);
    expect(isValidPaystackSignature(body, sign(body, "sk_test_other"), SECRET)).toBe(false);
    expect(isValidPaystackSignature(body, null, SECRET)).toBe(false);
    expect(isValidPaystackSignature(body, "abc", SECRET)).toBe(false);
  });
});

describe("readSuccessfulCharge", () => {
  it("reads a successful naira charge", () => {
    expect(readSuccessfulCharge({ status: "success", reference: "r1", amount: 500000, currency: "NGN" })).toEqual({ reference: "r1", amountKobo: 500000 });
  });

  it.each([
    { status: "failed", reference: "r1", amount: 500000, currency: "NGN" },
    { status: "success", reference: "r1", amount: 500000, currency: "USD" },
    { status: "success", reference: "r1", amount: 5000.5, currency: "NGN" },
    { status: "success", amount: 500000, currency: "NGN" },
    null,
  ])("ignores %j", (data) => {
    expect(readSuccessfulCharge(data)).toBeNull();
  });
});

describe("isWorkerAuthorised", () => {
  const secret = "a".repeat(40);
  it("needs the exact bearer secret", () => {
    expect(isWorkerAuthorised(`Bearer ${secret}`, secret)).toBe(true);
    expect(isWorkerAuthorised(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isWorkerAuthorised(secret, secret)).toBe(false);
    expect(isWorkerAuthorised(null, secret)).toBe(false);
  });
  it("refuses everything when no secret is configured", () => {
    expect(isWorkerAuthorised("Bearer ", undefined)).toBe(false);
  });
});
