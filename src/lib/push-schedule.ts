/**
 * Pure timezone-aware scheduling logic for server-side reminder delivery.
 * Reminders store a local "HH:MM", a day-of-week set, and an IANA timezone.
 * The cron computes the current local moment per reminder and decides whether
 * to fire now (once per local day). Dependency-free + testable.
 */

export type ZonedNow = {
  weekday: number; // 0=Sun … 6=Sat, local to the timezone
  minutesOfDay: number; // local minutes since midnight
  localDate: string; // YYYY-MM-DD, local
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Resolve `now` into a target timezone's weekday/minutes/date. */
export function zonedNow(now: Date, tz: string): ZonedNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // some engines emit "24" at midnight
  return {
    weekday: WEEKDAY[parts.weekday] ?? 0,
    minutesOfDay: hour * 60 + parseInt(parts.minute, 10),
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/**
 * Should this reminder fire now? Fires once per local day, at/after the local
 * time, within `catchUpMinutes` (so a lagging cron still delivers, but we don't
 * fire a reminder the user set for the morning when they enable it at night).
 */
export function isReminderDue(
  r: { at_time: string; days: number[]; last_pushed_on: string | null },
  z: ZonedNow,
  catchUpMinutes = 120,
): boolean {
  if (!r.days.includes(z.weekday)) return false;
  if (r.last_pushed_on === z.localDate) return false;
  const [h, m] = r.at_time.slice(0, 5).split(":").map(Number);
  const target = (h || 0) * 60 + (m || 0);
  const delta = z.minutesOfDay - target;
  return delta >= 0 && delta <= catchUpMinutes;
}

/** Notification copy for a reminder. */
export function reminderMessage(r: { kind: string; label: string }): {
  title: string;
  body: string;
  url: string;
} {
  if (r.kind === "verse") {
    return {
      title: "Today's verse is ready",
      body: "Open Faith Companion for today's Scripture.",
      url: "/home",
    };
  }
  return {
    title: r.label || "Time to pray",
    body: "Take a quiet moment to pray.",
    url: "/prayers",
  };
}
