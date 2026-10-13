import { describe, expect, it } from "vitest";
import { formatNigerianPhone, parseNigerianPhone, phoneToSpeech } from "../src/phone";

describe("parseNigerianPhone", () => {
  it.each([
    "08031234567",
    "8031234567",
    "2348031234567",
    "+2348031234567",
    "002348031234567",
    "+234 (0) 803-123-4567",
    "0803 123 4567",
    "0803.123.4567",
  ])("accepts %s", (input) => {
    expect(parseNigerianPhone(input)).toMatchObject({ valid: true, e164: "+2348031234567", national: "08031234567" });
  });

  it("accepts 070, 081, 090 and 091 prefixes", () => {
    for (const n of ["07012345678", "08123456789", "09012345678", "09123456789"]) {
      expect(parseNigerianPhone(n).valid).toBe(true);
    }
  });

  it("explains that 0722831876 is one digit short", () => {
    const r = parseNigerianPhone("0722831876");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/Too short/);
  });

  it("rejects foreign numbers, letters, empty values and bad prefixes", () => {
    expect(parseNigerianPhone("+447911123456").reason).toMatch(/Not a Nigerian/);
    expect(parseNigerianPhone("0803ABC4567").reason).toMatch(/letters/);
    expect(parseNigerianPhone("").reason).toMatch(/empty/);
    expect(parseNigerianPhone("06012345678").reason).toMatch(/prefix/);
    expect(parseNigerianPhone("080312345678").reason).toMatch(/Too long/);
  });
});

describe("phone formatting", () => {
  it("formats for screens", () => {
    expect(formatNigerianPhone("+2348031234567")).toBe("0803 123 4567");
  });

  it("reads back in digit groups", () => {
    expect(phoneToSpeech("+2348031234567")).toBe("zero eight zero three, one two three, four five six seven");
  });
});
