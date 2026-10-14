import { describe, expect, it } from "vitest";
import { checkCallAttempt, effectiveCallingWindow, type CallAttemptInput } from "../src/compliance";
import { fromLagosParts } from "../src/time";

// Tuesday 13 October 2026.
const at = (hour: number, minute = 0) => fromLagosParts(2026, 10, 13, hour, minute);

function input(patch: Partial<CallAttemptInput> = {}, lead: Partial<CallAttemptInput["lead"]> = {}): CallAttemptInput {
  return {
    now: at(10),
    agentReady: true,
    lead: { phone: "+2348031234567", optedOut: false, consent: true, source: "Website", ...lead },
    doNotCall: new Set(),
    attempts: 0,
    maxAttempts: 3,
    lastAttemptAt: null,
    retryAfterMinutes: 240,
    ...patch,
  };
}

const codes = (i: CallAttemptInput) => checkCallAttempt(i).blocks.map((b) => b.code);

describe("checkCallAttempt", () => {
  it("allows a clean attempt", () => {
    expect(checkCallAttempt(input())).toEqual({ allowed: true, blocks: [] });
  });

  it.each([
    ["opted out", input({}, { optedOut: true }), "opted_out"],
    ["on the do-not-call list", input({ doNotCall: new Set(["+2348031234567"]) }, { phone: "08031234567" }), "do_not_call"],
    ["without consent", input({}, { consent: false }), "no_consent"],
    ["without a lead source", input({}, { source: "  " }), "no_lead_source"],
    ["with a bad number", input({}, { phone: "0722831876" }), "invalid_phone"],
    ["with an agent that is not ready", input({ agentReady: false }), "agent_not_ready"],
    ["at 21:00", input({ now: at(21) }), "outside_calling_hours"],
    ["at 07:59", input({ now: at(7, 59) }), "outside_calling_hours"],
    ["after the attempt limit", input({ attempts: 3 }), "max_attempts"],
    ["too soon after the last attempt", input({ attempts: 1, lastAttemptAt: at(9) }), "too_soon"],
  ])("blocks a call %s", (_, i, code) => {
    expect(codes(i)).toContain(code);
  });

  it("lists every reason at once", () => {
    expect(codes(input({ now: at(22) }, { optedOut: true, consent: false }))).toEqual(["opted_out", "no_consent", "outside_calling_hours"]);
  });

  it("marks reasons as permanent or temporary", () => {
    const blocks = checkCallAttempt(input({ now: at(22) }, { optedOut: true })).blocks;
    expect(blocks.find((b) => b.code === "opted_out")?.permanent).toBe(true);
    expect(blocks.find((b) => b.code === "outside_calling_hours")?.permanent).toBe(false);
  });

  it("uses the campaign window, but never wider than the legal default", () => {
    const campaignWindow = { start: "06:00", end: "12:00", days: [1, 2, 3, 4, 5] as const };
    expect(codes(input({ now: at(7), campaignWindow: { ...campaignWindow, days: [...campaignWindow.days] } }))).toContain("outside_calling_hours");
    expect(codes(input({ now: at(13), campaignWindow: { ...campaignWindow, days: [...campaignWindow.days] } }))).toContain("outside_calling_hours");
    expect(codes(input({ now: at(11), campaignWindow: { ...campaignWindow, days: [...campaignWindow.days] } }))).toEqual([]);
  });
});

describe("effectiveCallingWindow", () => {
  it("narrows to the overlap with 08:00-21:00", () => {
    expect(effectiveCallingWindow({ start: "07:00", end: "22:00", days: [1, 2] })).toEqual({ start: "08:00", end: "21:00", days: [1, 2] });
    expect(effectiveCallingWindow({ start: "09:30", end: "17:00", days: [0, 6] })).toEqual({ start: "09:30", end: "17:00", days: [0, 6] });
  });
});
