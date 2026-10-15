import { describe, expect, it } from "vitest";
import { weeklyProgress } from "./progress";

const entry = { layers: [], techniques: [] };
const tasks = [{ id: 1, subjectId: 10, plan: [{ ...entry, bpm: 100 }] }, { id: 2, subjectId: 20 }];
const sessions = [
  { taskId: 1, subjectId: 10, date: "2026-10-05", marks: [{ ...entry, bpm: 90, confidence: 2 }] },
  { taskId: 1, subjectId: 10, date: "2026-10-06", marks: [{ ...entry, bpm: 100, confidence: 5 }] },
  { taskId: 1, subjectId: 10, date: "2026-10-06", marks: [{ ...entry, bpm: 95 }] },
  { taskId: 2, subjectId: 20, date: "2026-10-07", marks: [{ ...entry, bpm: 200, confidence: 4 }] },
];

describe("weeklyProgress", () => {
  it("aggregates per subject for the current week", () => {
    const [w] = weeklyProgress(sessions, tasks, 10, 1, "2026-10-08");
    expect(w).toEqual({ weekKey: "2026-10-05", bpm: 100, confidence: 3.5, activeDays: 2, goalRate: 33 });
  });
  it("returns empty weeks oldest first", () => {
    const res = weeklyProgress(sessions, tasks, undefined, 2, "2026-10-08");
    expect(res[0]).toMatchObject({ weekKey: "2026-09-28", bpm: null, activeDays: 0 });
    expect(res[1].activeDays).toBe(3);
  });
  it("filters marks by segment", () => {
    const seg = [{ taskId: 1, subjectId: 10, date: "2026-10-05", marks: [{ ...entry, segmentId: 7, bpm: 80 }, { ...entry, segmentId: 8, bpm: 120 }] }];
    expect(weeklyProgress(seg, tasks, { segmentId: 7 }, 1, "2026-10-08")[0].bpm).toBe(80);
  });
});
