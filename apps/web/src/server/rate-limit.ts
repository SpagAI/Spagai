/**
 * Simple in-memory rate limiter (fixed window per key).
 * Good enough for one server in development. Production with several servers
 * needs a shared store such as Redis (see docs/DEVELOPER_HANDOFF.md).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the window resets. */
  retryAfterMs: number;
}

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count++;
    if (this.hits.size > 10_000) this.sweep(t);
    const allowed = entry.count <= this.limit;
    return { allowed, remaining: Math.max(0, this.limit - entry.count), retryAfterMs: allowed ? 0 : entry.resetAt - t };
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Login link requests: per email address and per IP address. */
export const loginByEmail = new RateLimiter(5, FIFTEEN_MINUTES);
export const loginByIp = new RateLimiter(20, FIFTEEN_MINUTES);
