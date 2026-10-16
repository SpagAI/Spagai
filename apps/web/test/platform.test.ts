import { describe, expect, it } from "vitest";
import { change, niceMax } from "../src/lib/dashboard-types";
import { availableNumbers, formatNumber } from "../src/lib/numbers";
import { can } from "../src/server/permissions";

describe("number catalogue", () => {
  it("gives the same available numbers for the same search", () => {
    expect(availableNumbers("NG", "01")).toEqual(availableNumbers("NG", "01"));
    expect(availableNumbers("NG", "01", 1)).not.toEqual(availableNumbers("NG", "01", 0));
  });

  it("only offers numbers in the chosen area, at the catalogue price", () => {
    for (const n of availableNumbers("GB", "020")) {
      expect(n.number.startsWith("+4420")).toBe(true);
      expect(n.monthlyNaira).toBe(9800);
    }
    expect(availableNumbers("NG", "999")).toEqual([]);
  });

  it("formats numbers for people", () => {
    expect(formatNumber("+2349012345678")).toBe("+234 901 234 5678");
    expect(formatNumber("+17135550142")).toBe("+1 (713) 555-0142");
  });
});

describe("dashboard helpers", () => {
  it("rounds the axis up to a tidy number", () => {
    expect(niceMax(105)).toBe(120);
    expect(niceMax(0)).toBe(4);
  });

  it("shows no change when there is nothing to compare with", () => {
    expect(change(10, 0)).toBeNull();
    expect(change(150, 100)).toBe(50);
  });
});

describe("new permissions", () => {
  it("lets only owners and admins buy numbers and manage keys", () => {
    expect(can("ADMIN", "number:manage")).toBe(true);
    expect(can("MEMBER", "number:manage")).toBe(false);
    expect(can("MEMBER", "apikey:manage")).toBe(false);
    expect(can("MEMBER", "knowledge:edit")).toBe(true);
    expect(can("VIEWER", "knowledge:edit")).toBe(false);
  });
});
