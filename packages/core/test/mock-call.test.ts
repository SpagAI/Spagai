import { describe, expect, it } from "vitest";
import { DEFAULT_SILENCE, type ToolId } from "../src/agent";
import { pickPersona, runMockCall, type Persona } from "../src/simulator";
import { fromLagosParts } from "../src/time";

const NOW = fromLagosParts(2026, 10, 13, 10, 30); // Tuesday
const TOOLS: ToolId[] = ["check_calendar", "book_appointment", "save_lead_data", "end_call"];

const call = (persona: Persona, tools = TOOLS) =>
  runMockCall({
    persona,
    firstMessage: "Good morning, Mr Okafor. Is this a good time to talk?",
    values: { suffix: "Sir", goodbye: "Have a great day.", company_name: "Spag Finance" },
    tools,
    silence: DEFAULT_SILENCE,
    now: NOW,
  });

describe("pickPersona", () => {
  it("is stable for the same seed and varied across seeds", () => {
    expect(pickPersona("lead-1")).toBe(pickPersona("lead-1"));
    const seen = new Set(Array.from({ length: 200 }, (_, i) => pickPersona(`lead-${i}`)));
    expect(seen.size).toBe(8);
  });
});

describe("runMockCall", () => {
  it("books an interested customer on the next working day", () => {
    const r = call("interested");
    expect(r.outcome).toBe("booked");
    expect(r.toolCalls).toContainEqual({ tool: "book_appointment", args: { appointment_date: "2026-10-14", appointment_time: "10:00" } });
    expect(r.transcript.at(-1)?.role).toBe("agent");
    expect(r.durationSeconds).toBeGreaterThan(10);
  });

  it("records a callback", () => {
    const r = call("callback");
    expect(r.outcome).toBe("callback");
    expect(r.callback).toEqual({ date: "2026-10-14", time: "16:00" });
  });

  it("records an opt-out even when the agent has no save tool", () => {
    const r = call("opt_out", ["end_call"]);
    expect(r.optedOut).toBe(true);
    expect(r.outcome).toBe("opted_out");
  });

  it.each([
    ["not_interested", "not_interested"],
    ["wrong_number", "wrong_number"],
    ["no_answer", "no_answer"],
    ["silent", "no_answer"],
  ] as const)("%s ends as %s", (persona, outcome) => {
    expect(call(persona).outcome).toBe(outcome);
  });

  it("does not answer for no_answer, and ends silent calls with the closing message", () => {
    expect(call("no_answer")).toMatchObject({ answered: false, transcript: [] });
    expect(call("silent").transcript.at(-1)?.text).toBe(DEFAULT_SILENCE.closingMessage);
  });
});

describe("outcomes are not overwritten", () => {
  it("saves only the booking when the customer says goodbye after booking", () => {
    const saves = call("interested").toolCalls.filter((c) => c.tool === "save_lead_data");
    expect(saves).toEqual([{ tool: "save_lead_data", args: { outcome: "booked", interest_level: "high" } }]);
  });
});
