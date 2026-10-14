import { describe, expect, it } from "vitest";
import {
  billableMinutes,
  callCostKobo,
  canAffordCall,
  checkTopUp,
  DEFAULT_RATE_PER_MINUTE_KOBO,
  formatNaira,
  minutesCovered,
  parseNairaInput,
} from "../src/billing";

describe("billing", () => {
  it("charges every started minute and nothing for unanswered calls", () => {
    expect(billableMinutes(0)).toBe(0);
    expect(billableMinutes(1)).toBe(1);
    expect(billableMinutes(60)).toBe(1);
    expect(billableMinutes(61)).toBe(2);
    expect(callCostKobo(44, DEFAULT_RATE_PER_MINUTE_KOBO)).toBe(15_000);
    expect(callCostKobo(-5, 15_000)).toBe(0);
  });

  it("formats naira", () => {
    expect(formatNaira(123_450)).toBe("₦1,234.50");
    expect(formatNaira(100_000)).toBe("₦1,000");
    expect(formatNaira(5)).toBe("₦0.05");
    expect(formatNaira(-15_000)).toBe("-₦150");
    expect(formatNaira(500_000_000)).toBe("₦5,000,000");
  });

  it("reads typed amounts into kobo", () => {
    expect(parseNairaInput("5000")).toBe(500_000);
    expect(parseNairaInput("₦5,000.5")).toBe(500_050);
    expect(parseNairaInput("N 2,500.75")).toBe(250_075);
    expect(parseNairaInput("ngn1000")).toBe(100_000);
    for (const bad of ["", "abc", "-500", "5.555", "1e5", "0"]) expect(parseNairaInput(bad), bad).toBeNull();
  });

  it("checks top-up limits", () => {
    expect(checkTopUp(500_000)).toEqual({ ok: true, kobo: 500_000 });
    expect(checkTopUp(99_999)).toMatchObject({ ok: false });
    expect(checkTopUp(500_000_001)).toMatchObject({ ok: false });
    expect(checkTopUp(null)).toMatchObject({ ok: false });
  });

  it("needs at least one minute of balance to call", () => {
    expect(canAffordCall(15_000, 15_000)).toBe(true);
    expect(canAffordCall(14_999, 15_000)).toBe(false);
    expect(minutesCovered(100_000, 15_000)).toBe(6);
    expect(minutesCovered(-1, 15_000)).toBe(0);
  });
});
