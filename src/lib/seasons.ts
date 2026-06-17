/**
 * Liturgical-season detection for seasonal conversion campaigns (Lent &
 * Advent are the documented subscription peaks). Pure + date-injectable so
 * the home banner and tests are deterministic.
 *
 * Dates are approximate windows (Easter/Lent move yearly); for production,
 * back these with a proper liturgical-calendar table. Good enough to drive
 * the campaign banner today.
 */

export type Season = {
  key: "lent" | "advent" | "newyear";
  title: string;
  blurb: string;
  cta: string;
} | null;

// Approximate Ash Wednesday → Easter windows by year (UTC dates).
const LENT_WINDOWS: Record<number, [string, string]> = {
  2026: ["2026-02-18", "2026-04-05"],
  2027: ["2027-02-10", "2027-03-28"],
  2028: ["2028-03-01", "2028-04-16"],
};

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function currentSeason(date: Date = new Date()): Season {
  const iso = date.toISOString().slice(0, 10);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  const lent = LENT_WINDOWS[year];
  if (lent && inRange(iso, lent[0], lent[1])) {
    return {
      key: "lent",
      title: "The Lent Challenge",
      blurb: "40 days of guided prayer and Scripture. Begin the journey.",
      cta: "Join the challenge",
    };
  }

  // Advent: the four Sundays before Christmas ≈ Dec 1–24.
  if (month === 12 && day <= 24) {
    return {
      key: "advent",
      title: "Advent: Prepare the Way",
      blurb: "A daily devotion counting down to Christmas.",
      cta: "Start Advent",
    };
  }

  // New Year reset — strong habit-formation window.
  if ((month === 12 && day >= 27) || (month === 1 && day <= 10)) {
    return {
      key: "newyear",
      title: "New Year, New Rhythm",
      blurb: "Build the daily habit that lasts all year.",
      cta: "Start fresh",
    };
  }

  return null;
}
