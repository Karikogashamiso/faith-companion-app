import { describe, expect, it } from "bun:test";
import {
  dailyAchievementCodes,
  levelFromXp,
  XP_PER_LEVEL,
} from "../src/lib/gamification";
import { currentSeason } from "../src/lib/seasons";

describe("levelFromXp", () => {
  it("starts at level 1 with 0 xp", () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(1);
    expect(l.rank).toBe("Seeker");
    expect(l.progress).toBe(0);
  });
  it("levels up every 100 xp and reports progress within the level", () => {
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
    expect(levelFromXp(250).intoLevel).toBe(50);
    expect(levelFromXp(250).progress).toBeCloseTo(0.5);
    expect(levelFromXp(150).forLevel).toBe(XP_PER_LEVEL);
  });
  it("clamps negatives and caps the rank name", () => {
    expect(levelFromXp(-50).level).toBe(1);
    expect(levelFromXp(99999).rank).toBe("Saint");
  });
});

describe("dailyAchievementCodes", () => {
  it("always includes first_step", () => {
    expect(dailyAchievementCodes({ streak: 1, planJustFinished: false })).toEqual(
      ["first_step"],
    );
  });
  it("adds streak tiers as thresholds are crossed", () => {
    expect(dailyAchievementCodes({ streak: 7, planJustFinished: false })).toEqual(
      ["first_step", "streak_3", "streak_7"],
    );
  });
  it("adds plan_done when a plan is finished", () => {
    expect(
      dailyAchievementCodes({ streak: 30, planJustFinished: true }),
    ).toContain("plan_done");
  });
});

describe("currentSeason", () => {
  it("detects Lent inside the window", () => {
    expect(currentSeason(new Date("2026-03-01")).key).toBe("lent");
  });
  it("detects Advent in December", () => {
    expect(currentSeason(new Date("2026-12-10")).key).toBe("advent");
  });
  it("detects the New Year reset window", () => {
    expect(currentSeason(new Date("2026-01-03")).key).toBe("newyear");
  });
  it("returns null in ordinary time", () => {
    expect(currentSeason(new Date("2026-07-15"))).toBeNull();
  });
});
