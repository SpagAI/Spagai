import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The voice worker proves who it is with "Authorization: Bearer <WORKER_SHARED_SECRET>".
 * Compared in constant time. With no secret configured, every request is refused.
 */
export function isWorkerAuthorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}
