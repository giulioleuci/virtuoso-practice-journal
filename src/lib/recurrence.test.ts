import { describe, it, expect } from "vitest";
import { schoolYearEnd, expandTaskRecurrence, upcomingLessonDates, scheduleWindowEnd, windowedRecurrenceDates } from "./recurrence";
import { dayKey, parseDayKey } from "./date";
import type { LessonRecurrence } from "@/domain/entities/lesson";

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

  it("stops when hitting MAX_GENERATED if no endDate/occurrences are provided", () => {
    // Picking every single day, so it will hit 200 limit before 365 days horizon
    const dates = expandTaskRecurrence({
      kind: "weekdays",
      days: [0, 1, 2, 3, 4, 5, 6],
      startDate: "2025-01-01",
    });
    expect(dates).toHaveLength(200);
  });

  it("stops when hitting HORIZON_DAYS if cap is not reached", () => {
    // Picking only Sunday, 52 or 53 Sundays in 365 days
    const dates = expandTaskRecurrence({
      kind: "weekdays",
      days: [0],
      startDate: "2025-01-05", // First Sunday of 2025
    });
    expect(dates.length).toBeLessThan(60);
    // Horizon is 365 days. 2025-01-05 + 365 = 2026-01-05
    expect(dates[dates.length - 1] < "2026-01-06").toBe(true);
  });

  it("handles leap year boundaries correctly", () => {
    const dates = expandTaskRecurrence({
      kind: "weekdays",
      days: [4], // Thursday
      startDate: "2024-02-22",
      occurrences: 3,
    });
    expect(dates).toEqual(["2024-02-22", "2024-02-29", "2024-03-07"]);
  });

  it("handles Daylight Saving Time (DST) boundaries correctly", () => {
    const dates = expandTaskRecurrence({
      kind: "weekdays",
      days: [1], // Monday
      startDate: "2024-03-04",
      occurrences: 5,
    });
    expect(dates).toEqual(["2024-03-04", "2024-03-11", "2024-03-18", "2024-03-25", "2024-04-01"]);
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

  it("defaults step to 1 if everyXDays is undefined, 0, or negative", () => {
    const datesUndef = expandTaskRecurrence({
      kind: "interval",
      startDate: "2025-01-01",
      occurrences: 3,
    });
    expect(datesUndef).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);

    const datesZero = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 0,
      startDate: "2025-01-01",
      occurrences: 3,
    });
    expect(datesZero).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);

    const datesNeg = expandTaskRecurrence({
      kind: "interval",
      everyXDays: -5,
      startDate: "2025-01-01",
      occurrences: 3,
    });
    expect(datesNeg).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
  });

  it("respects occurrences cap", () => {
    const dates = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 2,
      startDate: "2025-01-01",
      occurrences: 4,
    });
    expect(dates).toEqual(["2025-01-01", "2025-01-03", "2025-01-05", "2025-01-07"]);
  });

  it("stops when hitting MAX_GENERATED if no endDate/occurrences are provided", () => {
    const dates = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 1,
      startDate: "2025-01-01",
    });
    expect(dates).toHaveLength(200);
  });

  it("stops when hitting HORIZON_DAYS if cap is not reached", () => {
    const dates = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 10,
      startDate: "2025-01-01",
    });
    // 365 / 10 = ~37 occurrences
    expect(dates.length).toBeLessThan(40);
    expect(dates[dates.length - 1] < "2026-01-02").toBe(true);
  });

  it("handles leap year boundaries correctly", () => {
    const dates = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 7,
      startDate: "2024-02-22",
      occurrences: 3,
    });
    expect(dates).toEqual(["2024-02-22", "2024-02-29", "2024-03-07"]);
  });

  it("handles Daylight Saving Time (DST) boundaries correctly", () => {
    const dates = expandTaskRecurrence({
      kind: "interval",
      everyXDays: 7,
      startDate: "2024-03-04",
      occurrences: 5,
    });
    expect(dates).toEqual(["2024-03-04", "2024-03-11", "2024-03-18", "2024-03-25", "2024-04-01"]);
  });
});

describe("upcomingLessonDates", () => {
  it("projects weekly lessons from a start date", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      schedules: [{ dayOfWeek: 1, startTime: "10:00", endTime: "11:00", frequency: "weekly" }],
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
      schedules: [{ dayOfWeek: 4, startTime: "10:00", endTime: "11:00", frequency: "weekly" }],
      startDate: "2024-02-22",
      color: "blue",
      createdAt: 0,
    };
    const dates = upcomingLessonDates(rec, 3, new Date(2024, 1, 22));
    expect(dates).toEqual(["2024-02-22", "2024-02-29", "2024-03-07"]);
  });

  it("handles Daylight Saving Time (DST) boundaries correctly", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      schedules: [{ dayOfWeek: 1, startTime: "10:00", endTime: "11:00", frequency: "weekly" }],
      startDate: "2024-03-04",
      color: "blue",
      createdAt: 0,
    };
    const dates = upcomingLessonDates(rec, 5, new Date(2024, 2, 4));
    expect(dates).toEqual(["2024-03-04", "2024-03-11", "2024-03-18", "2024-03-25", "2024-04-01"]);
  });

  it("maintains biweekly parity across DST boundaries", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      schedules: [{ dayOfWeek: 1, startTime: "10:00", endTime: "11:00", frequency: "biweekly" }],
      startDate: "2024-01-01",
      color: "blue",
      createdAt: 0,
    };

    const startDates = upcomingLessonDates(rec, 5, new Date(2024, 0, 1));
    expect(startDates).toEqual([
      "2024-01-01", "2024-01-15", "2024-01-29", "2024-02-12", "2024-02-26"
    ]);

    const lateDates = upcomingLessonDates(rec, 3, new Date(2024, 4, 6));
    expect(lateDates).toEqual(["2024-05-06", "2024-05-20", "2024-06-03"]);
  });

  it("merges and sorts dates across multiple schedule slots", () => {
    const rec: LessonRecurrence = {
      subjectId: 1,
      teacher: "T",
      schedules: [
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00", frequency: "weekly" }, // Mon
        { dayOfWeek: 4, startTime: "15:00", endTime: "16:00", frequency: "weekly" }, // Thu
      ],
      startDate: "2025-01-06",
      color: "blue",
      createdAt: 0,
    };
    const dates = upcomingLessonDates(rec, 4, new Date(2025, 0, 6));
    expect(dates).toEqual(["2025-01-06", "2025-01-09", "2025-01-13", "2025-01-16"]);
  });
});


describe("rolling schedule window", () => {
  const daily = { kind: "interval" as const, everyXDays: 1, startDate: "2026-10-28", endDate: "2027-06-30" };

  it("ends 14 days after the later of start and today", () => {
    expect(scheduleWindowEnd("2026-10-01", "2026-10-28")).toBe("2026-11-11");
    expect(scheduleWindowEnd("2026-12-01", "2026-10-28")).toBe("2026-12-15");
  });

  it("writes only the window of a daily rule", () => {
    const dates = windowedRecurrenceDates(daily, undefined, "2026-10-28");
    expect(dates).toHaveLength(15);
    expect(dates.at(-1)).toBe("2026-11-11");
  });

  it("keeps the next occurrence of a sparse rule even beyond the window", () => {
    const rec = { kind: "interval" as const, everyXDays: 30, startDate: "2026-10-20" };
    expect(windowedRecurrenceDates(rec, undefined, "2026-10-28")).toEqual(["2026-10-20", "2026-11-19"]);
  });

  it("adds nothing when the window is already written", () => {
    expect(windowedRecurrenceDates(daily, "2026-11-11", "2026-10-28")).toEqual([]);
  });

  it("continues after a given date", () => {
    const dates = windowedRecurrenceDates(daily, "2026-11-05", "2026-10-28");
    expect(dates[0]).toBe("2026-11-06");
    expect(dates.at(-1)).toBe("2026-11-11");
  });
});
