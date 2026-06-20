import { describe, expect, it } from "bun:test";
import { challengeProgress, canCompleteDay } from "../src/lib/challenge";

describe("challengeProgress", () => {
  it("starts on day 1 with nothing done", () => {
    const p = challengeProgress(0, 7);
    expect(p).toMatchObject({ done: 0, total: 7, currentDay: 1, isComplete: false, percent: 0 });
  });

  it("advances the current day as days complete", () => {
    expect(challengeProgress(3, 7).currentDay).toBe(4);
    expect(challengeProgress(3, 7).percent).toBe(43);
  });

  it("marks complete on the final day", () => {
    const p = challengeProgress(7, 7);
    expect(p.isComplete).toBe(true);
    expect(p.currentDay).toBe(7);
    expect(p.percent).toBe(100);
  });

  it("clamps overflow and negatives", () => {
    expect(challengeProgress(99, 7).done).toBe(7);
    expect(challengeProgress(-2, 7).done).toBe(0);
  });

  it("handles a zero-day challenge safely", () => {
    expect(challengeProgress(0, 0)).toMatchObject({ currentDay: 0, isComplete: false, percent: 0 });
  });
});

describe("canCompleteDay", () => {
  it("is true mid-challenge, false once finished", () => {
    expect(canCompleteDay(2, 7)).toBe(true);
    expect(canCompleteDay(7, 7)).toBe(false);
  });
});
