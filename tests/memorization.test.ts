import { describe, expect, it } from "bun:test";
import {
  addDaysISO,
  isMastered,
  MASTERED_STAGE,
  reviewMemory,
  STEP_DAYS,
} from "../src/lib/memorization";

describe("reviewMemory", () => {
  it("advances the stage and lengthens the interval when remembered", () => {
    expect(reviewMemory(0, true)).toEqual({ stage: 1, dueInDays: STEP_DAYS[1] });
    expect(reviewMemory(2, true).stage).toBe(3);
    expect(reviewMemory(2, true).dueInDays).toBeGreaterThan(
      reviewMemory(1, true).dueInDays,
    );
  });
  it("resets to stage 0 when forgotten", () => {
    expect(reviewMemory(5, false)).toEqual({ stage: 0, dueInDays: STEP_DAYS[0] });
  });
  it("caps the interval at the last step", () => {
    expect(reviewMemory(20, true).dueInDays).toBe(STEP_DAYS[STEP_DAYS.length - 1]);
  });
});

describe("isMastered", () => {
  it("is true once the ladder is fully climbed", () => {
    expect(isMastered(MASTERED_STAGE)).toBe(true);
    expect(isMastered(MASTERED_STAGE - 1)).toBe(false);
  });
});

describe("addDaysISO", () => {
  it("crosses month boundaries", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
  });
});
