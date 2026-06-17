import { describe, expect, it } from "bun:test";
import {
  describeDays,
  formatTime,
  nextOccurrence,
  parseHHMM,
} from "../src/lib/reminders";

describe("formatTime / parseHHMM", () => {
  it("formats 24h to 12h", () => {
    expect(formatTime("07:30")).toBe("7:30 AM");
    expect(formatTime("13:05")).toBe("1:05 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
  it("parses HH:MM", () => {
    expect(parseHHMM("09:45")).toEqual({ h: 9, m: 45 });
  });
});

describe("describeDays", () => {
  it("names common patterns", () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeDays([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(describeDays([0, 6])).toBe("Weekends");
    expect(describeDays([0, 3])).toBe("Sun, Wed");
  });
});

describe("nextOccurrence", () => {
  it("returns later today when the time is still ahead", () => {
    const now = new Date("2026-06-17T06:00:00"); // Wed
    const next = nextOccurrence(now, "07:30", [0, 1, 2, 3, 4, 5, 6])!;
    expect(next.getHours()).toBe(7);
    expect(next.getDate()).toBe(17);
  });
  it("rolls to the next selected day when today's time has passed", () => {
    const now = new Date("2026-06-17T09:00:00"); // Wed
    const next = nextOccurrence(now, "07:30", [0, 1, 2, 3, 4, 5, 6])!;
    expect(next.getDate()).toBe(18); // Thu
  });
  it("skips unselected days", () => {
    const now = new Date("2026-06-17T09:00:00"); // Wed
    const next = nextOccurrence(now, "07:30", [0])!; // Sundays only
    expect(next.getDay()).toBe(0);
  });
  it("returns null with no days", () => {
    expect(nextOccurrence(new Date(), "07:30", [])).toBeNull();
  });
});
