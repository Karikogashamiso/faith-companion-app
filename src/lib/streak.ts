/**
 * Streak math for the daily habit layer. Pure + dependency-free so it can be
 * unit-tested and reused. A streak is a run of consecutive local calendar
 * days on which the user showed up; "yesterday" still counts as on-streak
 * (grace) so a single missed check-in mid-day doesn't read as broken.
 *
 * All date arithmetic is done on YYYY-MM-DD strings via UTC to avoid the
 * local/UTC drift that off-by-ones a naive `new Date(...).setDate(...)`.
 */

/** Today's date as a local-time YYYY-MM-DD string. */
export function todayLocalISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add `n` days to a YYYY-MM-DD string, returning a YYYY-MM-DD string. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Given a list of YYYY-MM-DD activity dates, return the current and longest
 * streaks. `today` is injectable for deterministic testing.
 */
export function computeStreak(
  dates: string[],
  today: string = todayLocalISO(),
): { current: number; longest: number } {
  if (!dates.length) return { current: 0, longest: 0 };
  const set = new Set(dates);

  let longest = 0;
  for (const d of set) {
    // Only count from the start of a run (no predecessor) to stay O(n).
    if (set.has(addDays(d, -1))) continue;
    let len = 1;
    while (set.has(addDays(d, len))) len++;
    if (len > longest) longest = len;
  }

  // Current streak: count back from today, or from yesterday (grace day).
  let cursor = set.has(today) ? today : addDays(today, -1);
  let cur = 0;
  while (set.has(cursor)) {
    cur++;
    cursor = addDays(cursor, -1);
  }
  return { current: cur, longest };
}
