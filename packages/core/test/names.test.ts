import { describe, expect, it } from "vitest";
import { getNamePronunciation, NAME_DICTIONARY_STATUS, NAME_PRONUNCIATIONS } from "../src";

describe("names pronunciation dictionary", () => {
  it("has about 30 names across Yoruba, Igbo and Hausa, all unverified", () => {
    expect(NAME_PRONUNCIATIONS.length).toBeGreaterThanOrEqual(30);
    for (const lang of ["yo", "ig", "ha"]) {
      expect(NAME_PRONUNCIATIONS.filter((n) => n.language === lang).length).toBeGreaterThanOrEqual(10);
    }
    expect(NAME_PRONUNCIATIONS.every((n) => n.verified === false)).toBe(true);
    expect(NAME_DICTIONARY_STATUS).toMatch(/TO BE VERIFIED BY NATIVE SPEAKERS/);
  });

  it("looks names up case-insensitively", () => {
    expect(getNamePronunciation("chinedu")?.hint).toBe("chee-NEH-doo");
    expect(getNamePronunciation("Nobody")).toBeUndefined();
  });

  it("has no duplicates", () => {
    const names = NAME_PRONUNCIATIONS.map((n) => n.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
