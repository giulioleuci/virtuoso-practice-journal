import { describe, expect, it } from "vitest";
import type { Assignment } from "@/domain/entities/lesson";
import type { Task } from "@/domain/entities/task";
import { assignmentsToPlan } from "./assignments";

describe("assignmentsToPlan", () => {
  const assignments = [{ id: 1, taskIds: [7] }, { id: 2, taskIds: [] }] as unknown as Assignment[];

  it("reports nothing pending while tasks are still loading", () => {
    expect(assignmentsToPlan(assignments, undefined)).toEqual([]);
  });

  it("keeps assignments without an active task", () => {
    expect(assignmentsToPlan(assignments, [{ id: 7 }] as Task[]).map((a) => a.id)).toEqual([2]);
  });
});
