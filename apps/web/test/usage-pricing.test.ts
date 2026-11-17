import { describe, expect, it } from "vitest";
import { billedListeningSeconds, costUsd, formatUsd, summarise } from "@/lib/usage-pricing";

describe("usage pricing", () => {
  it("prices each service from its published rate", () => {
    expect(costUsd("ai_input_tokens", 1_000_000)).toBeCloseTo(0.15);
    expect(costUsd("ai_output_tokens", 1_000_000)).toBeCloseTo(0.6);
    expect(costUsd("voice_characters", 1_000_000)).toBeCloseTo(15);
    expect(costUsd("listening_seconds", 3600)).toBeCloseTo(0.111);
    expect(costUsd("ai_replies", 50)).toBe(0);
  });

  it("bills at least 10 seconds per recording", () => {
    expect(billedListeningSeconds(3.2)).toBe(10);
    expect(billedListeningSeconds(14.1)).toBe(15);
  });

  it("adds up a test call like Lucy's (10 replies, long prompt)", () => {
    const s = summarise({ ai_input_tokens: 75_000, ai_output_tokens: 3_000, ai_replies: 10, voice_characters: 1_400, listening_seconds: 120 });
    expect(s.ai.usd).toBeCloseTo(0.01305, 5);
    expect(s.voice.usd).toBeCloseTo(0.021, 5);
    expect(s.listening.minutes).toBe(2);
    expect(s.totalUsd).toBeCloseTo(0.01305 + 0.021 + 0.0037, 4);
  });

  it("shows small amounts with enough digits", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.0037)).toBe("$0.0037");
    expect(formatUsd(1.234)).toBe("$1.23");
  });
});
