import { describe, expect, it } from "vitest";
import { weeklyProgress } from "./progress";

const tasks = [{ id: 1, subjectId: 10, targetBpm: 100 }, { id: 2, subjectId: 20 }];
const sessions = [
  { taskId: 1, date: "2026-10-05", bpmReached: 90, quality: "hard" as const },
  { taskId: 1, date: "2026-10-06", bpmReached: 100, quality: "great" as const },
  { taskId: 1, date: "2026-10-06", bpmReached: 95 },
  { taskId: 2, date: "2026-10-07", bpmReached: 200, quality: "well" as const },
];

describe("weeklyProgress", () => {
  it("aggregates per subject for the current week", () => {
    const [w] = weeklyProgress(sessions, tasks, 10, 1, "2026-10-08");
    expect(w).toEqual({ weekKey: "2026-10-05", bpm: 100, quality: 2.5, activeDays: 2, goalRate: 33 });
  });
  it("returns empty weeks oldest first", () => {
    const res = weeklyProgress(sessions, tasks, undefined, 2, "2026-10-08");
    expect(res[0]).toMatchObject({ weekKey: "2026-09-28", bpm: null, activeDays: 0 });
    expect(res[1].activeDays).toBe(3);
  });
});
