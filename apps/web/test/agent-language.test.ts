import { describe, expect, it } from "vitest";
import { languageLine } from "@/lib/agent-language";

describe("languageLine", () => {
  it("adds nothing for English agents", () => {
    expect(languageLine("en-NG")).toBeNull();
    expect(languageLine(undefined)).toBeNull();
  });

  it("gives Pidgin agents a firm rule to reply only in Pidgin, with numbers in words", () => {
    const line = languageLine("pcm")!;
    expect(line).toMatch(/ONLY in Nigerian Pidgin, every single turn/);
    expect(line).toMatch(/numbers in words/);
  });

  it("asks Yoruba, Hausa and Igbo agents to reply in their language", () => {
    expect(languageLine("yo")).toMatch(/reply in Yoruba/);
    expect(languageLine("ha")).toMatch(/reply in Hausa/);
    expect(languageLine("ig")).toMatch(/reply in Igbo/);
  });
});
