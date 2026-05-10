import { describe, it, expect } from "vitest";
import { dayKey, parseDayKey, schoolYearEnd, expandTaskRecurrence, upcomingLessonDates } from "./recurrence";
import type { LessonRecurrence } from "./db";

describe("dayKey / parseDayKey", () => {
  it("round-trips a date", () => {
    const d = new Date(2025, 0, 7);
    expect(dayKey(d)).toBe("2025-01-07");
    expect(parseDayKey("2025-01-07").getTime()).toBe(d.getTime());
  });
});

describe("schoolYearEnd", () => {
  it("returns June 30 of the current academic year (autumn)", () => {
    expect(schoolYearEnd(new Date(2024, 9, 1))).toBe("2025-06-30");
  });
  it("returns June 30 of current calendar year before September", () => {
    expect(schoolYearEnd(new Date(2025, 2, 1))).toBe("2025-06-30");
  });
});

describe("expandTaskRecurrence — weekdays", () => {
  it("returns only matching weekdays within range", () => {
    const dates = expandTaskRecurrence({
      kind: "weekdays",
      days: [1, 3], // Mon, Wed
      startDate: "2025-01-06", // Monday
      endDate: "2025-01-15",
    });
    expect(dates).toEqual(["2025-01-06", "2025-01-08", "2025-01-13", "2025-01-15"]);
  });

  it("respects occurrences cap", () => {
    const dates = expandTaskRecurrence({
      kind: "weekdays",
      days: [0, 1, 2, 3, 4, 5, 6],
      startDate: "2025-01-01",
      occurrences: 3,
    });
    expect(dates).toHaveLength(3);
  });

  it("returns empty when no days picked", () => {
    expect(expandTaskRecurrence({ kind: "weekdays", days: [], startDate: "2025-01-01" })).toEqual([]);
  });
});

describe("expandTaskRecurrence — interval", () => {
  it("steps every X days", () => {
    const dates = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 3,
      startDate: "2025-01-01",
      endDate: "2025-01-10",
    });
    expect(dates).toEqual(["2025-01-01", "2025-01-04", "2025-01-07", "2025-01-10"]);
  });
});

describe("upcomingLessonDates", () => {
  it("projects weekly lessons from a start date", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      frequency: "weekly",
      dayOfWeek: 1, // Monday
      startTime: "10:00",
      endTime: "11:00",
      startDate: "2025-01-06",
      color: "blue",
      createdAt: 0,
    };
    const dates = upcomingLessonDates(rec, 3, new Date(2025, 0, 6));
    expect(dates).toEqual(["2025-01-06", "2025-01-13", "2025-01-20"]);
  });

  it("handles leap year boundaries correctly", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      frequency: "weekly",
      dayOfWeek: 4, // Thursday
      startTime: "10:00",
      endTime: "11:00",
      startDate: "2024-02-22", // Thursday before leap day
      color: "blue",
      createdAt: 0,
    };
    const dates = upcomingLessonDates(rec, 3, new Date(2024, 1, 22)); // Feb 22, 2024
    // 2024 is a leap year, so Feb 29 exists
    expect(dates).toEqual(["2024-02-22", "2024-02-29", "2024-03-07"]);
  });

  it("handles Daylight Saving Time (DST) boundaries correctly", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      frequency: "weekly",
      dayOfWeek: 1, // Monday
      startTime: "10:00",
      endTime: "11:00",
      startDate: "2024-03-04", // Monday before DST change (US Mar 10, EU Mar 31)
      color: "blue",
      createdAt: 0,
    };
    const dates = upcomingLessonDates(rec, 5, new Date(2024, 2, 4)); // Mar 4, 2024
    expect(dates).toEqual(["2024-03-04", "2024-03-11", "2024-03-18", "2024-03-25", "2024-04-01"]);
  });

  it("maintains biweekly parity across DST boundaries", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      frequency: "biweekly",
      dayOfWeek: 1, // Monday
      startTime: "10:00",
      endTime: "11:00",
      startDate: "2024-01-01", // Start beginning of year
      color: "blue",
      createdAt: 0,
    };

    // Check biweekly dates right from the start
    const startDates = upcomingLessonDates(rec, 5, new Date(2024, 0, 1));
    expect(startDates).toEqual([
      "2024-01-01", "2024-01-15", "2024-01-29", "2024-02-12", "2024-02-26"
    ]);

    // Check biweekly dates long after a DST transition (e.g. May 2024)
    // 2024-01-01 + 18 weeks = 2024-05-06
    // If parity is calculated wrongly via Math.floor, it might skip 2024-05-06 and yield 2024-05-13
    const lateDates = upcomingLessonDates(rec, 3, new Date(2024, 4, 6)); // May 6, 2024
    expect(lateDates).toEqual(["2024-05-06", "2024-05-20", "2024-06-03"]);
  });
});
