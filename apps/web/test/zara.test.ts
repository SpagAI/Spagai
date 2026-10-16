import { describe, expect, it } from "vitest";
import { draftPlan, refinePlan, soundsLikeARequest, wantsToBuild } from "../src/lib/zara";

const company = "Spag Demo Finance";

describe("Zara's plans", () => {
  it("picks the right kind of agent from a description", () => {
    expect(draftPlan("A receptionist that books appointments for my clinic", { company })).toMatchObject({ presetId: "clinic-booking", direction: "inbound", company });
    expect(draftPlan("Remind customers about their loan repayments", { company })).toMatchObject({ presetId: "repayment-reminders", direction: "outbound" });
    expect(draftPlan("Confirm delivery addresses before dispatch", { company }).presetId).toBe("delivery-confirmation");
  });

  it("reads the business name and agent name when given", () => {
    const p = draftPlan("Build an agent called Tunde to call leads for Lekki Gardens", { company });
    expect(p.agentName).toBe("Tunde");
    expect(p.company).toBe("Lekki Gardens");
  });

  it("makes a custom agent when nothing matches", () => {
    const p = draftPlan("Make an agent that tells church members about Sunday service times", { company });
    expect(p.presetId).toBeNull();
    expect(p.purpose.length).toBeGreaterThan(10);
  });

  it("applies follow-up changes", () => {
    const p = draftPlan("Remind customers about repayments", { company });
    const { plan, changes } = refinePlan(p, "call her Ngozi and use a Pidgin voice");
    expect(plan.agentName).toBe("Ngozi");
    expect(plan.language).toBe("pcm");
    expect(changes.length).toBe(2);
    expect(refinePlan(p, "make it answer calls").plan.direction).toBe("inbound");
  });

  it("knows when to build and when someone is just chatting", () => {
    expect(wantsToBuild("looks good, build it")).toBe(true);
    expect(wantsToBuild("not yet, wait")).toBe(false);
    expect(soundsLikeARequest("hello")).toBe(false);
    expect(soundsLikeARequest("call my customers about our new savings plan")).toBe(true);
  });
});

describe("Zara's voice choice", () => {
  it("uses a male voice when told to call the agent 'him'", () => {
    expect(draftPlan("Remind customers about repayments, call him Tunde", { company }).voiceGender).toBe("male");
    expect(draftPlan("Book clinic appointments, name her Ada", { company }).voiceGender).toBe("female");
  });
});
