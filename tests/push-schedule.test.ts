import { describe, expect, it } from "bun:test";
import { zonedNow, isReminderDue, reminderMessage } from "../src/lib/push-schedule";

describe("zonedNow", () => {
  // 2026-06-18T12:00:00Z is a Thursday.
  const utcNoon = new Date("2026-06-18T12:00:00Z");

  it("reports UTC correctly", () => {
    const z = zonedNow(utcNoon, "UTC");
    expect(z.weekday).toBe(4); // Thursday
    expect(z.minutesOfDay).toBe(12 * 60);
    expect(z.localDate).toBe("2026-06-18");
  });

  it("shifts back across the date line for New York (EDT -4)", () => {
    const z = zonedNow(new Date("2026-06-18T02:00:00Z"), "America/New_York");
    // 02:00 UTC = 22:00 the previous day in EDT.
    expect(z.localDate).toBe("2026-06-17");
    expect(z.weekday).toBe(3); // Wednesday
    expect(z.minutesOfDay).toBe(22 * 60);
  });

  it("shifts forward for Tokyo (JST +9)", () => {
    const z = zonedNow(utcNoon, "Asia/Tokyo");
    expect(z.minutesOfDay).toBe(21 * 60); // 12:00 UTC = 21:00 JST
    expect(z.localDate).toBe("2026-06-18");
  });
});

describe("isReminderDue", () => {
  const z = { weekday: 4, minutesOfDay: 7 * 60 + 35, localDate: "2026-06-18" }; // Thu 07:35

  it("fires at/just after the local time on a selected day", () => {
    expect(isReminderDue({ at_time: "07:30:00", days: [1, 2, 3, 4, 5], last_pushed_on: null }, z)).toBe(true);
  });

  it("does not fire before the local time", () => {
    expect(isReminderDue({ at_time: "08:00:00", days: [4], last_pushed_on: null }, z)).toBe(false);
  });

  it("does not fire on an unselected weekday", () => {
    expect(isReminderDue({ at_time: "07:30:00", days: [0, 6], last_pushed_on: null }, z)).toBe(false);
  });

  it("does not fire twice on the same local day", () => {
    expect(
      isReminderDue({ at_time: "07:30:00", days: [4], last_pushed_on: "2026-06-18" }, z),
    ).toBe(false);
  });

  it("does not fire long after the time (outside catch-up window)", () => {
    const late = { weekday: 4, minutesOfDay: 11 * 60, localDate: "2026-06-18" };
    expect(isReminderDue({ at_time: "07:30:00", days: [4], last_pushed_on: null }, late)).toBe(false);
  });

  it("still fires within a widened catch-up window", () => {
    const late = { weekday: 4, minutesOfDay: 9 * 60, localDate: "2026-06-18" };
    expect(isReminderDue({ at_time: "07:30:00", days: [4], last_pushed_on: null }, late, 120)).toBe(true);
  });
});

describe("reminderMessage", () => {
  it("uses verse copy + home deep link for verse reminders", () => {
    const m = reminderMessage({ kind: "verse", label: "" });
    expect(m.title).toContain("verse");
    expect(m.url).toBe("/home");
  });
  it("uses the custom label for prayer reminders", () => {
    const m = reminderMessage({ kind: "prayer", label: "Evening prayer" });
    expect(m.title).toBe("Evening prayer");
    expect(m.url).toBe("/prayers");
  });
});
