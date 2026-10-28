import { addDays, dayKey, parseDayKey } from "@/lib/date";

const day = (n: number) => dayKey(addDays(parseDayKey("2026-10-28"), n));
const task = (id: number, date: string, extra: object = {}) => ({ id, date, subjectId: 1, linkType: "free", title: `t${id}`, plan: [], done: false, createdAt: 1, ...extra });

/** Pre-window data as of 2026-10-28: a daily series and a daily routine 60 days deep, plus one far-future row of each protected kind (ids 200-205). */
export function scheduleFixture() {
  const days = Array.from({ length: 60 }, (_, n) => n);
  return {
    tasks: [
      task(1, day(0), { recurrence: { kind: "interval", everyXDays: 1, startDate: day(0) } }),
      ...days.slice(1).map((n) => task(1 + n, day(n), { recurrenceTaskId: 1 })),
      ...days.map((n) => task(100 + n, day(n), { studyRoutineId: 1 })),
      ...[{ done: true }, { skipped: true }, { customized: true }, { executionNotes: "kept" }, {}, {}].map((extra, i) => task(200 + i, `2027-03-0${i + 1}`, { studyRoutineId: 1, ...extra })),
    ],
    studyRoutines: [{ id: 1, subjectId: 1, groups: [], matrix: {}, weeksAhead: 49, repetitionCap: 1, startDate: day(0), createdAt: 1 }],
    sessions: [{ id: 1, taskId: 204, date: "2027-03-05", marks: [], createdAt: 1 }],
    assignments: [{ id: 1, lessonId: 1, text: "x", taskIds: [205], createdAt: 1 }],
  };
}
export const PROTECTED_IDS = [200, 201, 202, 203, 204, 205];
export const WINDOW_END = day(14);
