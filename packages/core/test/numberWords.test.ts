import { describe, expect, it } from "vitest";
import { decimalToWords, integerToWords, ordinalToWords, yearToWords } from "../src";

describe("number words", () => {
  it.each([
    [0, "zero"], [7, "seven"], [21, "twenty-one"], [105, "one hundred and five"],
    [1005, "one thousand and five"], [1520, "one thousand, five hundred and twenty"],
    [2_500_000, "two million, five hundred thousand"], [-3, "minus three"],
  ])("%i -> %s", (n, w) => expect(integerToWords(n)).toBe(w));

  it("handles decimals, ordinals and years", () => {
    expect(decimalToWords("2.05")).toBe("two point zero five");
    expect(ordinalToWords(1)).toBe("first");
    expect(ordinalToWords(22)).toBe("twenty-second");
    expect(ordinalToWords(30)).toBe("thirtieth");
    expect(yearToWords(2026)).toBe("twenty twenty-six");
    expect(yearToWords(2005)).toBe("two thousand and five");
    expect(yearToWords(1905)).toBe("nineteen oh five");
  });

  it("rejects non-integers", () => {
    expect(() => integerToWords(1.5)).toThrow();
  });
});
