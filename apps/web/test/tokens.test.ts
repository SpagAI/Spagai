import { describe, expect, it } from "vitest";
import { generateToken, hashToken, normaliseEmail, safeEqual } from "@/server/auth/tokens";
import { defaultOrganisationName } from "@/server/auth/naming";

describe("login tokens", () => {
  it("are long, random and URL-safe", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("are stored only as a SHA-256 hash", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashToken(token)).toBe(hash);
  });

  it("compare in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("normalise emails", () => {
    expect(normaliseEmail("  Ada.Obi@GMAIL.com ")).toBe("ada.obi@gmail.com");
  });
});

describe("defaultOrganisationName", () => {
  it("uses the company domain, or the person's name for webmail", () => {
    expect(defaultOrganisationName("ada@spagfinance.ng")).toBe("Spagfinance");
    expect(defaultOrganisationName("chinedu.okafor@gmail.com")).toBe("Chinedu's organisation");
  });
});
