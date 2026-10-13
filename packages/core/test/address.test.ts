import { describe, expect, it } from "vitest";
import { buildAddress, checkAddressRule, normaliseTitle } from "../src/address";

describe("buildAddress", () => {
  it("defaults to Mr for men and Miss for women (Mode A uses the last name)", () => {
    expect(buildAddress({ gender: "male", firstName: "Chinedu", lastName: "Okafor" })).toMatchObject({
      address: "Mr Okafor", suffix: "Sir", title: "Mr", usedDefaultTitle: true,
    });
    expect(buildAddress({ gender: "female", firstName: "Ngozi", lastName: "Eze" })).toMatchObject({
      address: "Miss Eze", suffix: "Ma", title: "Miss", usedDefaultTitle: true,
    });
  });

  it("treats Sir and Ma as no title", () => {
    expect(buildAddress({ title: "Sir", gender: "male", lastName: "Bello" }).address).toBe("Mr Bello");
    expect(buildAddress({ title: "Ma", gender: "F", lastName: "Eze" }).address).toBe("Miss Eze");
    expect(buildAddress({ title: "madam", gender: "female", lastName: "Eze" }).address).toBe("Miss Eze");
  });

  it("keeps a real title and cleans its spelling", () => {
    expect(buildAddress({ title: "dr.", gender: "female", lastName: "adeyemi" }).address).toBe("Dr Adeyemi");
    expect(buildAddress({ title: "ENGR", gender: "male", lastName: "Musa" }).address).toBe("Engr Musa");
  });

  it("Mode B uses the first name only", () => {
    const r = buildAddress({ title: "Dr", gender: "female", firstName: "amaka", lastName: "Obi", mode: "B" });
    expect(r).toMatchObject({ address: "Amaka", suffix: "Ma", title: "" });
  });

  it("Mode B falls back to title + last name when there is no first name", () => {
    expect(buildAddress({ gender: "male", lastName: "Okafor", mode: "B" }).address).toBe("Mr Okafor");
  });

  it("does not guess a title when gender is unknown", () => {
    expect(buildAddress({ firstName: "Tunde", lastName: "Bakare" })).toMatchObject({
      address: "Bakare", suffix: "", title: "", usedDefaultTitle: false, gender: "unknown",
    });
  });

  it("infers gender from gendered titles", () => {
    expect(buildAddress({ title: "Alhaji", lastName: "Bello" })).toMatchObject({ address: "Alhaji Bello", suffix: "Sir" });
    expect(buildAddress({ title: "Mrs", lastName: "Okoro" })).toMatchObject({ suffix: "Ma" });
  });

  it("keeps names that are already mixed case", () => {
    expect(buildAddress({ gender: "male", lastName: "McDonald" }).address).toBe("Mr McDonald");
  });
});

describe("normaliseTitle", () => {
  it("returns empty for unknown titles and for Sir/Ma", () => {
    expect(normaliseTitle("Sir")).toBe("");
    expect(normaliseTitle("ma'am")).toBe("");
    expect(normaliseTitle("Captain")).toBe("");
    expect(normaliseTitle("Barr.")).toBe("Barr");
  });
});

describe("checkAddressRule", () => {
  it("flags Sir/Ma next to a title", () => {
    expect(checkAddressRule("Thank you, Mr Okafor Sir.")).toHaveLength(1);
  });

  it("flags Sir/Ma next to the person's name", () => {
    const v = checkAddressRule("Chinedu, ma, thank you.", { firstName: "Chinedu" });
    expect(v[0]?.reason).toMatch(/name/);
  });

  it("flags Sir/Ma next to a name placeholder, including {{suffix}}", () => {
    expect(checkAddressRule("Good morning {{address}}, {{suffix}}.")).toHaveLength(1);
    expect(checkAddressRule("Hello {{lead_name}} Sir.")).toHaveLength(1);
  });

  it("allows Sir/Ma in a separate sentence", () => {
    expect(checkAddressRule("Good morning, Mr Okafor. Is now a good time, Sir?")).toEqual([]);
    expect(checkAddressRule("Good morning, {{address}}. How are you, {{suffix}}?")).toEqual([]);
  });
});
