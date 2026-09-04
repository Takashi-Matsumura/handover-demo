import { describe, expect, it } from "vitest";
import { isValidWorkType, WORK_TYPE_DEFS } from "@/app/lib/work-types";

describe("work-types", () => {
  it("defines both work types with non-empty grillAxes", () => {
    for (const wt of ["budget-execution", "law-enforcement"] as const) {
      const def = WORK_TYPE_DEFS[wt];
      expect(def.grillAxes.length).toBeGreaterThan(0);
      expect(def.researchSeeds.length).toBeGreaterThan(0);
    }
  });

  it("keeps the two work types' grill axes disjoint (no accidental copy-paste)", () => {
    const budget = new Set(WORK_TYPE_DEFS["budget-execution"].grillAxes);
    const law = new Set(WORK_TYPE_DEFS["law-enforcement"].grillAxes);
    for (const axis of budget) {
      expect(law.has(axis)).toBe(false);
    }
  });

  it("isValidWorkType rejects arbitrary strings", () => {
    expect(isValidWorkType("budget-execution")).toBe(true);
    expect(isValidWorkType("law-enforcement")).toBe(true);
    expect(isValidWorkType("something-else")).toBe(false);
    expect(isValidWorkType(undefined)).toBe(false);
  });
});
