import { describe, expect, it } from "vitest";
import { isSensitiveHeader, parseCsv, parseLeadCsv } from "../src/leads";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and new lines inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"line\nbreak",2\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["line\nbreak", "2"],
    ]);
  });

  it("drops blank lines and a byte-order mark", () => {
    expect(parseCsv("﻿a\n\n1\n")).toEqual([["a"], ["1"]]);
  });
});

describe("isSensitiveHeader", () => {
  it.each(["BVN", "Card Number", "card_pan", "PIN", "otp", "Password", "NIN"])("blocks %s", (h) => {
    expect(isSensitiveHeader(h)).toBe(true);
  });
  it.each(["phone", "pinned_note", "opinion", "amount_due", "company"])("allows %s", (h) => {
    expect(isSensitiveHeader(h)).toBe(false);
  });
});

describe("parseLeadCsv", () => {
  const csv = [
    "First Name,Surname,Title,Gender,Phone,Email,Source,Consent,Amount Due,BVN",
    "Chinedu,Okafor,,M,0803 123 4567,chinedu@example.com,Website form,yes,\"25,000\",22123456789",
    "Amaka,Eze,Dr,female,+2348091234567,,Referral,no,10000,",
    "Bad,Number,,m,0722831876,,Website form,yes,,",
    "Dupe,Person,,m,08031234567,,Website form,yes,,",
    ",NoName,,,08051234567,,Website form,yes,,",
  ].join("\n");

  it("reads valid leads, maps columns and keeps extra columns as call values", () => {
    const r = parseLeadCsv(csv);
    expect(r.leads).toHaveLength(2);
    expect(r.leads[0]).toEqual({
      firstName: "Chinedu",
      lastName: "Okafor",
      title: "",
      gender: "male",
      phone: "+2348031234567",
      email: "chinedu@example.com",
      source: "Website form",
      consent: true,
      extra: { amount_due: "25,000" },
    });
    expect(r.leads[1]).toMatchObject({ title: "Dr", gender: "female", consent: false });
  });

  it("refuses sensitive columns and never reads their values", () => {
    const r = parseLeadCsv(csv);
    expect(r.blockedColumns).toEqual(["BVN"]);
    expect(JSON.stringify(r.leads)).not.toContain("22123456789");
  });

  it("reports bad rows and duplicates", () => {
    const r = parseLeadCsv(csv);
    expect(r.duplicates).toBe(1);
    expect(r.errors.map((e) => e.row)).toEqual([4, 6]);
    expect(r.errors[1]!.reason).toBe("First name is empty.");
  });

  it("needs a source for every lead, from a column or the whole file", () => {
    const noSource = "name,phone\nTunde Bakare,08031234567";
    expect(parseLeadCsv(noSource).errors[0]!.reason).toContain("Lead source is empty");
    const r = parseLeadCsv(noSource, { defaultSource: "Trade fair 2026", defaultConsent: true });
    expect(r.leads[0]).toMatchObject({ firstName: "Tunde", lastName: "Bakare", source: "Trade fair 2026", consent: true });
  });

  it("explains a missing phone column", () => {
    expect(parseLeadCsv("first_name\nAda").errors[0]!.reason).toContain("No phone column");
  });
});
