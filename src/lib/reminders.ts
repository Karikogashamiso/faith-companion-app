/**
 * Pure helpers for reminder times. Time is stored as "HH:MM" (24h, local).
 * `days` is a set of 0–6 (Sun–Sat). All dependency-free + testable.
 */

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.slice(0, 5).split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

/** "07:30" → "7:30 AM". */
export function formatTime(hhmm: string): string {
  const { h, m } = parseHHMM(hhmm);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Short human description of the day set ("Every day", "Weekdays", "Sun, Wed"). */
export function describeDays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d)))
    return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...days].sort().map((d) => names[d]).join(", ") || "Never";
}

/**
 * The next Date this reminder should fire after `now`, or null if no days are
 * selected. Looks up to 8 days ahead.
 */
export function nextOccurrence(
  now: Date,
  hhmm: string,
  days: number[],
): Date | null {
  if (!days.length) return null;
  const { h, m } = parseHHMM(hhmm);
  const set = new Set(days);
  for (let offset = 0; offset <= 8; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    if (set.has(d.getDay()) && d.getTime() > now.getTime()) return d;
  }
  return null;
}
