/**
 * Spaced-repetition scheduling for verse memorization (a Leitner-style ladder).
 * Pure + dependency-free so it's testable and runs anywhere. Each stage maps to
 * a growing interval before the next review; remembering advances a stage,
 * forgetting drops back to the start.
 */

/** Days until the next review at each stage (index = stage, capped at the end). */
export const STEP_DAYS = [1, 2, 4, 9, 19, 35, 60, 120];

export const MASTERED_STAGE = STEP_DAYS.length;

export function reviewMemory(
  stage: number,
  remembered: boolean,
): { stage: number; dueInDays: number } {
  const nextStage = remembered ? Math.max(0, stage) + 1 : 0;
  const idx = Math.min(nextStage, STEP_DAYS.length - 1);
  return { stage: nextStage, dueInDays: STEP_DAYS[idx] };
}

export function isMastered(stage: number): boolean {
  return stage >= MASTERED_STAGE;
}

/** Add days to a YYYY-MM-DD string (UTC), returning YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
