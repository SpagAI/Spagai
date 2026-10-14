import { describe, expect, it } from "vitest";
import { DEFAULT_SILENCE, type ToolId } from "../src/agent";
import { lintSpokenLine } from "../src/prompt";
import {
  dateToSpeech,
  detectIntent,
  mockAgentReply,
  parseDay,
  parseTime,
  silenceTurn,
  timeToSpeech,
  type MockReplyInput,
} from "../src/simulator";
import { fromLagosParts } from "../src/time";

// Tuesday 13 October 2026, 10:30 WAT.
const NOW = fromLagosParts(2026, 10, 13, 10, 30);
const ALL_TOOLS: ToolId[] = ["check_calendar", "book_appointment", "save_lead_data", "end_call"];

function reply(callerText: string, extra: Partial<MockReplyInput> = {}) {
  return mockAgentReply({
    callerText,
    history: [],
    values: { suffix: "Sir", goodbye: "Have a great day.", company_name: "Spag Finance" },
    tools: ALL_TOOLS,
    now: NOW,
    ...extra,
  });
}

describe("detectIntent", () => {
  it.each([
    ["Please stop calling me", "opt_out"],
    ["Yes, but don't call me again", "opt_out"],
    ["Am I talking to a robot?", "ai_question"],
    ["You have the wrong number", "wrong_number"],
    ["I'm driving, call me later", "busy"],
    ["No, I'm not interested", "negative"],
    ["Yes please", "positive"],
    ["Thursday at 10am", "appointment"],
    ["my email is ada dot obi at gmail dot com", "email"],
    ["Hmm", "unclear"],
  ])("%s → %s", (text, intent) => {
    expect(detectIntent(text)).toBe(intent);
  });
});

describe("parseDay and parseTime", () => {
  it("reads days relative to the simulated time", () => {
    expect(parseDay("tomorrow", NOW)).toBe("2026-10-14");
    expect(parseDay("Thursday", NOW)).toBe("2026-10-15");
    expect(parseDay("Tuesday", NOW)).toBe("2026-10-20"); // next week, not today
    expect(parseDay("whenever", NOW)).toBeNull();
  });

  it("reads common time formats", () => {
    expect(parseTime("10am")).toBe("10:00");
    expect(parseTime("2:30 pm")).toBe("14:30");
    expect(parseTime("at 3")).toBe("15:00");
    expect(parseTime("14:00")).toBe("14:00");
    expect(parseTime("I have 2 kids")).toBeNull();
  });

  it("speaks dates and times naturally", () => {
    expect(dateToSpeech("2026-10-15")).toBe("Thursday 15 October");
    expect(timeToSpeech("14:30")).toBe("2 30 in the afternoon");
    expect(timeToSpeech("09:00")).toBe("9 in the morning");
  });
});

describe("mockAgentReply", () => {
  it("always honours an opt-out: saves it and ends the call", () => {
    const r = reply("Please stop calling me");
    expect(r.endsCall).toBe(true);
    expect(r.toolCalls).toContainEqual({ tool: "save_lead_data", args: { outcome: "opted_out", opt_out: true } });
    expect(r.toolCalls.at(-1)?.tool).toBe("end_call");
  });

  it("discloses that it is an AI when asked", () => {
    expect(reply("Is this a robot?").text).toContain("I am an AI assistant calling on behalf of Spag Finance");
  });

  it("books a valid appointment across two turns", () => {
    const first = reply("Thursday");
    expect(first.text).toContain("What time on Thursday 15 October");
    const second = reply("10am", { history: [{ role: "caller", text: "Thursday" }, { role: "agent", text: first.text }] });
    expect(second.toolCalls[0]).toEqual({ tool: "book_appointment", args: { appointment_date: "2026-10-15", appointment_time: "10:00" } });
  });

  it("refuses a booking outside booking hours", () => {
    const r = reply("Saturday at 10am");
    expect(r.toolCalls).toEqual([]);
    expect(r.text).toContain("not available");
  });

  it("saves a callback instead of booking after the caller says they are busy", () => {
    const r = reply("tomorrow at 4pm", { history: [{ role: "agent", text: "What day and time would be better for us to call you back?" }] });
    expect(r.toolCalls[0]).toEqual({ tool: "save_lead_data", args: { outcome: "callback", callback_date: "2026-10-14", callback_time: "16:00" } });
    expect(r.endsCall).toBe(true);
  });

  it("normalises a spoken email address", () => {
    const r = reply("my email is ada dot obi at gmail dot com");
    expect(r.toolCalls[0]?.args.email).toBe("ada.obi@gmail.com");
  });

  it("does not call tools the agent does not have", () => {
    const r = reply("No, not interested", { tools: ["end_call"] });
    expect(r.toolCalls.map((c) => c.tool)).toEqual(["end_call"]);
  });

  it("leaves out Sir/Ma when gender is unknown", () => {
    expect(reply("Hmm", { values: { suffix: "" } }).text).toBe("I am sorry, I did not quite catch that. Could you say that again?");
  });

  it("produces lines that pass the spoken-line linter", () => {
    const samples = ["stop calling", "robot?", "wrong number", "I'm busy", "bye", "no", "yes", "Thursday", "Thursday 10am", "Saturday 10am", "Hmm", "my email is ada at gmail dot com"];
    for (const text of samples) expect(lintSpokenLine(reply(text).text), text).toEqual([]);
  });
});

describe("silenceTurn", () => {
  it("checks in first, then closes and ends the call", () => {
    const first = silenceTurn(DEFAULT_SILENCE, 0);
    expect(first).toMatchObject({ text: DEFAULT_SILENCE.checkInMessage, endsCall: false, afterSeconds: 7 });
    const second = silenceTurn(DEFAULT_SILENCE, 1);
    expect(second).toMatchObject({ text: DEFAULT_SILENCE.closingMessage, endsCall: true, afterSeconds: 15 });
  });
});
