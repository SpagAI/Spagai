import { describe, expect, it } from "vitest";
import { expressText, roundTo, speedText, volumeText } from "@/lib/voice-settings-text";

describe("voice setting words", () => {
  it("speed in steps of 0.1", () => {
    expect(speedText(1)).toBe("1.0× · normal speed");
    expect(speedText(1.2)).toBe("1.2× · 20% faster");
    expect(speedText(0.8)).toBe("0.8× · 20% slower");
    expect(speedText(0.1 + 0.2 + 0.9)).toBe("1.2× · 20% faster");
    expect(roundTo(1.25, 0.1)).toBeCloseTo(1.3);
  });
  it("loudness in steps of 1", () => {
    expect(volumeText(0)).toBe("0 · normal loudness");
    expect(volumeText(3)).toBe("+3 · a little louder");
    expect(volumeText(-5)).toBe("-5 · quieter");
    expect(volumeText(10)).toBe("+10 · much louder");
  });
  it("expressiveness shown out of 10", () => {
    expect(expressText(0.7)).toBe("7 / 10 · natural");
    expect(expressText(0.2)).toBe("2 / 10 · steady, the same each time");
    expect(expressText(1)).toBe("10 / 10 · lively and varied");
  });
});
