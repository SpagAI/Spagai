import { describe, expect, it } from "vitest";
import { fillSampleValues, sampleValueFor } from "@/lib/sample-values";

const now = new Date("2026-11-14T09:00:00Z");

describe("sample values for testing", () => {
  it("picks a value that fits the variable's name", () => {
    expect(sampleValueFor("patient_phone", "", now)).toBe("08031234567");
    expect(sampleValueFor("patient_email", "", now)).toMatch(/@example\.com$/);
    expect(sampleValueFor("patient_first_name", "", now)).toMatch(/^[A-Z][a-z]+$/);
    expect(sampleValueFor("doctor_name", "", now)).toMatch(/^Dr /);
    expect(sampleValueFor("appointment_date", "", now)).toBe("2026-11-17");
    expect(sampleValueFor("appointment_time", "", now)).toBe("10:00");
    expect(sampleValueFor("current_month", "", now)).toBe("November");
    expect(sampleValueFor("current_year", "", now)).toBe("2026");
    expect(sampleValueFor("loan_amount", "", now)).toBe("₦50,000");
    expect(sampleValueFor("order_reference", "", now)).toMatch(/^AB\d{4}$/);
    expect(sampleValueFor("remember_patient_detail", "", now)).toContain("prefers");
    expect(sampleValueFor("something_else", "", now)).toBe("example");
  });

  it("is the same every time for the same variable", () => {
    expect(sampleValueFor("customer_name", "", now)).toBe(sampleValueFor("customer_name", "", now));
  });

  it("only fills empty values", () => {
    const filled = fillSampleValues([{ name: "patient_first_name" }, { name: "visit_reason" }], { patient_first_name: "Chioma", visit_reason: " " }, now);
    expect(filled.patient_first_name).toBe("Chioma");
    expect(filled.visit_reason).toBe("a routine check-up");
  });
});
