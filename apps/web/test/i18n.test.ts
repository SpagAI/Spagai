import { describe, expect, it } from "vitest";
import { createTranslator, isLocale, LOCALES } from "@/i18n";
import en from "@/i18n/messages/en.json";

describe("translations", () => {
  it("looks up nested keys", () => {
    expect(createTranslator("en")("nav.agents")).toBe("Agents");
  });

  it("falls back to English for languages not translated yet", () => {
    for (const l of ["pcm", "yo", "ha", "ig"] as const) {
      expect(createTranslator(l)("login.title")).toBe("Sign in");
    }
  });

  it("returns the key when text is missing, and fills {placeholders}", () => {
    expect(createTranslator("en")("no.such.key")).toBe("no.such.key");
    expect(createTranslator("en")("common.error", { x: 1 })).toBe("Something went wrong.");
  });

  it("knows all five interface languages", () => {
    expect(LOCALES.map((l) => l.code)).toEqual(["en", "pcm", "yo", "ha", "ig"]);
    expect(isLocale("yo")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("has no empty English strings", () => {
    const walk = (o: object): string[] =>
      Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : walk(v as object)));
    expect(walk(en).every((s) => s.trim().length > 0)).toBe(true);
  });
});
