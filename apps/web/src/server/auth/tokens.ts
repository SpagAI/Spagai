/**
 * Token helpers (pure, no database). Tokens are random; only their SHA-256 hash is stored,
 * so a leaked database cannot be used to log in.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const LOGIN_TOKEN_TTL_MINUTES = 15;
export const SESSION_TTL_DAYS = 30;

export const emailSchemaMessage = "Enter a valid email address.";

/** Lower-case and trim an email address for storage and lookups. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
