/**
 * Gamification math + reward rules. Pure and dependency-free so it's
 * testable and can run on client or server. XP is the retention currency;
 * levels and achievements are the visible progress that keeps people
 * subscribed past the months where churn happens.
 */

export const XP_PER_LEVEL = 100;
export const DAILY_XP = 10; // showing up
export const PLAN_DAY_XP = 5; // completing a reading-plan day

/** Rank names give each level a sense of spiritual progression. */
const RANKS = [
  "Seeker",
  "Disciple",
  "Pilgrim",
  "Steward",
  "Witness",
  "Shepherd",
  "Saint",
];

export function levelFromXp(xp: number): {
  level: number;
  rank: string;
  intoLevel: number;
  forLevel: number;
  progress: number;
} {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const intoLevel = safe % XP_PER_LEVEL;
  return {
    level,
    rank: RANKS[Math.min(level - 1, RANKS.length - 1)],
    intoLevel,
    forLevel: XP_PER_LEVEL,
    progress: intoLevel / XP_PER_LEVEL,
  };
}

/**
 * Given the streak (including today) and whether a plan was just finished,
 * return the achievement codes worth *attempting* to unlock. unlock_achievement
 * is idempotent, so attempting an already-earned one is harmless.
 */
export function dailyAchievementCodes(opts: {
  streak: number;
  planJustFinished: boolean;
}): string[] {
  const codes = ["first_step"];
  if (opts.streak >= 3) codes.push("streak_3");
  if (opts.streak >= 7) codes.push("streak_7");
  if (opts.streak >= 30) codes.push("streak_30");
  if (opts.planJustFinished) codes.push("plan_done");
  return codes;
}
