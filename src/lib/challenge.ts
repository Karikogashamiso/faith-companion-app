/**
 * Pure progress logic for multi-day challenges. Challenges are self-paced:
 * completing a day unlocks the next. last_completed_day (0..dayCount) is the
 * source of truth. Dependency-free + testable.
 */

export type ChallengeProgress = {
  done: number;
  total: number;
  /** 1-based day the user should do next; equals total once finished. */
  currentDay: number;
  isComplete: boolean;
  percent: number;
};

export function challengeProgress(
  lastCompletedDay: number,
  dayCount: number,
): ChallengeProgress {
  const total = Math.max(0, dayCount);
  const done = Math.max(0, Math.min(lastCompletedDay, total));
  const isComplete = total > 0 && done >= total;
  const currentDay = total === 0 ? 0 : isComplete ? total : done + 1;
  return {
    done,
    total,
    currentDay,
    isComplete,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/** A user can mark "today" complete only when they're on that day and not done. */
export function canCompleteDay(lastCompletedDay: number, dayCount: number): boolean {
  return !challengeProgress(lastCompletedDay, dayCount).isComplete;
}
