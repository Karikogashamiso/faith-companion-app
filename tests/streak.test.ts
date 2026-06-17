import { describe, expect, it } from "bun:test";
import { addDays, computeStreak } from "../src/lib/streak";

describe("addDays", () => {
  it("handles month/year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("computeStreak", () => {
  it("returns zero for no activity", () => {
    expect(computeStreak([], "2026-06-17")).toEqual({ current: 0, longest: 0 });
  });

  it("counts a run ending today", () => {
    const dates = ["2026-06-15", "2026-06-16", "2026-06-17"];
    expect(computeStreak(dates, "2026-06-17")).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it("grants a grace day (yesterday keeps the streak alive)", () => {
    const dates = ["2026-06-15", "2026-06-16"];
    expect(computeStreak(dates, "2026-06-17").current).toBe(2);
  });

  it("breaks the current streak after a two-day gap", () => {
    const dates = ["2026-06-10", "2026-06-11"];
    expect(computeStreak(dates, "2026-06-17").current).toBe(0);
  });

  it("finds the longest historical run independent of the current one", () => {
    const dates = [
      "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", // run of 4
      "2026-06-17", // today, run of 1
    ];
    expect(computeStreak(dates, "2026-06-17")).toEqual({
      current: 1,
      longest: 4,
    });
  });

  it("ignores duplicate dates", () => {
    const dates = ["2026-06-17", "2026-06-17", "2026-06-16"];
    expect(computeStreak(dates, "2026-06-17").current).toBe(2);
  });
});
