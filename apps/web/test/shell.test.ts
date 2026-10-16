import { describe, expect, it } from "vitest";

import { creditPercentLeft, initialsOf } from "@/lib/shell-types";

describe("creditPercentLeft", () => {
  it("is the balance as a share of everything ever added", () => {
    expect(creditPercentLeft({ balanceKobo: 1_395_000, totalCreditedKobo: 1_500_000 })).toBe(93);
    expect(creditPercentLeft({ balanceKobo: 750_000, totalCreditedKobo: 1_500_000 })).toBe(50);
  });

  it("stays between 0 and 100, and is 0 when nothing was added", () => {
    expect(creditPercentLeft({ balanceKobo: -5_000, totalCreditedKobo: 100_000 })).toBe(0);
    expect(creditPercentLeft({ balanceKobo: 200_000, totalCreditedKobo: 100_000 })).toBe(100);
    expect(creditPercentLeft({ balanceKobo: 0, totalCreditedKobo: 0 })).toBe(0);
  });
});

describe("initialsOf", () => {
  it("uses the first letters of the first two names", () => {
    expect(initialsOf("Demo Owner", "demo@spagai.local")).toBe("DO");
    expect(initialsOf("  chinedu   okafor  nwosu ", "x@y.com")).toBe("CO");
  });

  it("falls back to part of the name, then to the email", () => {
    expect(initialsOf("Zara", "z@spagai.local")).toBe("ZA");
    expect(initialsOf(null, "team.spagai@gmail.com")).toBe("T");
    expect(initialsOf("   ", "ada@x.com")).toBe("A");
  });
});
