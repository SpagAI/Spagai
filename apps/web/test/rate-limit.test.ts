import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/server/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    expect([1, 2, 3].map(() => limiter.check("ip").allowed)).toEqual([true, true, true]);
    const blocked = limiter.check("ip");
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1000 });
    now = 1000;
    expect(limiter.check("ip").allowed).toBe(true);
  });

  it("counts keys separately", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });
});
