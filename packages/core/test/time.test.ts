import { describe, expect, it } from "vitest";
import {
  chooseGoodbye,
  fromLagosParts,
  getGreeting,
  getTimeOfDay,
  isWithinBookingWindow,
  isWithinCallingWindow,
  toLagosParts,
  validateAppointment,
} from "../src/time";

// 13 October 2026 is a Tuesday. 16 Oct = Friday, 17 = Saturday, 18 = Sunday.
const lagos = (day: number, hour: number, minute = 0) => fromLagosParts(2026, 10, day, hour, minute);

describe("Lagos time conversion", () => {
  it("is UTC+1", () => {
    const d = new Date("2026-10-13T09:00:00Z");
    expect(toLagosParts(d)).toMatchObject({ hour: 10, minute: 0, day: 13, weekday: 2 });
    expect(lagos(13, 10).toISOString()).toBe("2026-10-13T09:00:00.000Z");
  });

  it("handles the date changing at midnight Lagos time", () => {
    expect(toLagosParts(new Date("2026-10-13T23:30:00Z"))).toMatchObject({ day: 14, hour: 0, minute: 30 });
  });
});

describe("calling window 08:00-21:00 WAT", () => {
  it("allows calls from 08:00 up to 20:59", () => {
    expect(isWithinCallingWindow(lagos(13, 8, 0)).allowed).toBe(true);
    expect(isWithinCallingWindow(lagos(13, 20, 59)).allowed).toBe(true);
  });

  it("blocks 07:59 and 21:00, and says when it reopens", () => {
    const early = isWithinCallingWindow(lagos(13, 7, 59));
    expect(early.allowed).toBe(false);
    expect(early.reason).toMatch(/07:59 WAT is outside 08:00-21:00/);
    expect(early.nextOpenAt).toEqual(lagos(13, 8));

    const late = isWithinCallingWindow(lagos(13, 21, 0));
    expect(late.allowed).toBe(false);
    expect(late.nextOpenAt).toEqual(lagos(14, 8));
  });

  it("can exclude weekends", () => {
    const r = isWithinCallingWindow(lagos(17, 10), { start: "08:00", end: "21:00", days: [1, 2, 3, 4, 5] });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Saturday/);
    expect(r.nextOpenAt).toEqual(lagos(19, 8));
  });
});

describe("booking window 09:00-18:00 WAT, weekdays", () => {
  it("allows weekday office hours only", () => {
    expect(isWithinBookingWindow(lagos(13, 9)).allowed).toBe(true);
    expect(isWithinBookingWindow(lagos(13, 17, 59)).allowed).toBe(true);
    expect(isWithinBookingWindow(lagos(13, 18)).allowed).toBe(false);
    expect(isWithinBookingWindow(lagos(17, 11)).allowed).toBe(false);
  });
});

describe("validateAppointment", () => {
  const now = lagos(13, 10);

  it("accepts a valid future slot", () => {
    const r = validateAppointment("2026-10-14", "11:30", { now });
    expect(r.valid).toBe(true);
    expect(r.startsAt).toEqual(lagos(14, 11, 30));
  });

  it("rejects bad formats", () => {
    expect(validateAppointment("14/10/2026", "11:30", { now }).errors).toContain("appointment_date must be YYYY-MM-DD.");
    expect(validateAppointment("2026-10-14", "11.30am", { now }).errors).toContain(
      "appointment_time must be HH:MM in 24-hour time.",
    );
  });

  it("rejects impossible dates, past slots, and slots outside booking hours", () => {
    expect(validateAppointment("2026-02-30", "10:00", { now }).errors[0]).toMatch(/not a real calendar date/);
    expect(validateAppointment("2026-10-12", "10:00", { now }).errors).toContain("The appointment is in the past.");
    expect(validateAppointment("2026-10-14", "19:00", { now }).errors[0]).toMatch(/Outside booking hours/);
    expect(validateAppointment("2026-10-17", "10:00", { now }).errors[0]).toMatch(/Saturday/);
  });

  it("checks that the appointment ends inside the window", () => {
    expect(validateAppointment("2026-10-14", "17:45", { now, durationMinutes: 30 }).errors[0]).toMatch(/end after 18:00/);
  });
});

describe("time of day and greetings", () => {
  it.each([
    [5, "morning"], [11, "morning"], [12, "afternoon"], [16, "afternoon"], [17, "evening"], [22, "evening"], [3, "evening"],
  ] as const)("%i:00 is %s", (hour, tod) => {
    expect(getTimeOfDay(lagos(13, hour))).toBe(tod);
  });

  it("greets by time of day", () => {
    expect(getGreeting(lagos(13, 9))).toBe("Good morning");
  });
});

describe("chooseGoodbye", () => {
  it("chooses weekend from Friday 15:00, on Saturday, and Sunday daytime", () => {
    expect(chooseGoodbye(lagos(16, 14)).kind).toBe("day");
    expect(chooseGoodbye(lagos(16, 15)).kind).toBe("weekend");
    expect(chooseGoodbye(lagos(17, 19)).kind).toBe("weekend");
    expect(chooseGoodbye(lagos(18, 10)).kind).toBe("weekend");
  });

  it("chooses evening or day on weekdays", () => {
    expect(chooseGoodbye(lagos(13, 18))).toEqual({ kind: "evening", text: "Have a good evening." });
    expect(chooseGoodbye(lagos(13, 10))).toEqual({ kind: "day", text: "Have a great day." });
    expect(chooseGoodbye(lagos(18, 18)).kind).toBe("evening");
  });
});
