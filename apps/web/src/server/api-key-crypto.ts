import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * API key helpers (no "server-only" import, so the seed script can use them too).
 * A key looks like "spag_live_<32 random characters>". We keep:
 *  - a SHA-256 hash, to recognise the key when it is used, and
 *  - an AES-256-GCM encrypted copy, so the owner can reveal it again in the dashboard.
 * The encryption key is derived from SESSION_SECRET.
 */

export const KEY_PREFIX = "spag_live_";

export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(24).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** What lists show: "spag_live_3f9a…". */
export function displayPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 4);
}

const aesKey = (secret: string) => createHash("sha256").update(`api-keys:${secret}`).digest();

export function encryptApiKey(key: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(secret), iv);
  const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptApiKey(stored: string, secret: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Malformed stored key.");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
