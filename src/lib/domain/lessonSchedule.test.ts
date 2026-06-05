import { describe, it, expect } from "vitest";
import { nextLessonDate } from "@/lib/domain/lessonSchedule";
import type { Lesson, LessonRecurrence } from "@/lib/db";

const rec = (over: Partial<LessonRecurrence>): LessonRecurrence => ({
  subjectId: 1,
  teacher: "T",
  schedules: [{ dayOfWeek: 1, startTime: "10:00", endTime: "11:00", frequency: "weekly" }],
  startDate: "2026-05-01",
  color: "blue",
  createdAt: 0,
  ...over,
});


describe("nextLessonDate", () => {
  it("finds the next weekly recurrence date after the anchor", () => {
    // anchor Tue 2026-05-26 → next Monday is 2026-06-01
    const res = nextLessonDate([rec({})], { subjectId: 1, after: "2026-05-26" });
    expect(res).toBe("2026-06-01");
  });

  it("filters by subject", () => {
    const res = nextLessonDate([rec({ subjectId: 2 })], { subjectId: 1, after: "2026-05-26" });
    expect(res).toBeUndefined();
  });

  it("considers logged lessons too and picks the earliest candidate", () => {
    const lessons: Lesson[] = [
      { subjectId: 1, date: "2026-05-28", createdAt: 0 },
    ];
    const res = nextLessonDate([rec({})], { subjectId: 1, after: "2026-05-26", lessons });
    // logged lesson on 05-28 is earlier than next recurrence 06-01
    expect(res).toBe("2026-05-28");
  });

  it("ignores soft-deleted recurrences", () => {
    const res = nextLessonDate([rec({ deletedAt: 123 })], { subjectId: 1, after: "2026-05-26" });
    expect(res).toBeUndefined();
  });

  it("respects recurrence endDate", () => {
    const res = nextLessonDate(
      [rec({ endDate: "2026-05-30" })],
      { subjectId: 1, after: "2026-05-26" },
    );
    expect(res).toBeUndefined();
  });
});
