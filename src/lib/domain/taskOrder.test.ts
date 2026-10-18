import { describe, expect, it } from "vitest";
import type { Task } from "@/domain/entities/task";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import { routineTaskOrder, sortDiaryTasks } from "./taskOrder";

const task = (id: number, title: string, extra: Partial<Task> = {}): Task => ({
  id, title, date: "2026-10-18", subjectId: 1, plan: [], done: false, createdAt: id, ...extra,
});
const routine: StudyRoutine = {
  id: 1, subjectId: 1, createdAt: 0, startDate: "2026-10-18", weeksAhead: 1, repetitionCap: 1, matrix: {},
  groups: [
    { id: "scales", name: "Scale", pool: [{ type: "item", id: 2 }, { type: "segment", id: 9 }] },
    { id: "arpeggios", name: "Arpeggi", combine: true, pool: [{ type: "item", id: 3 }] },
    { id: "books", name: "Manuali", pool: [{ type: "collection", id: 4 }] },
  ],
};

describe("diary task order", () => {
  it("puts every routine before other tasks, following group order across subjects", () => {
    const tasks = [task(1, "Altro"), task(2, "Arpeggi", { studyRoutineId: 1, linkType: "free" }),
      task(3, "Scale", { studyRoutineId: 1, itemId: 2 }),
      task(4, "Routine violino", { studyRoutineId: 2, subjectId: 2 }),
      task(5, "Sezione", { studyRoutineId: 1, plan: [{ segmentId: 9, layers: [], techniques: [] }] })];
    expect(sortDiaryTasks(tasks, [routine], "routine", "it").map(t => t.id)).toEqual([3, 5, 2, 4, 1]);
    expect(tasks[0].id).toBe(1);
  });

  it("supports title and creation order, keeps completed tasks last and breaks ties by id", () => {
    const tasks = [task(3, "Scale 10"), task(2, "Scale 2"), task(1, "Arpeggi", { done: true })];
    expect(sortDiaryTasks(tasks, [], "title", "it").map(t => t.id)).toEqual([2, 3, 1]);
    expect(sortDiaryTasks(tasks, [], "created", "it").map(t => t.id)).toEqual([2, 3, 1]);
    expect(sortDiaryTasks([task(2, "A", { createdAt: 0 }), task(1, "A", { createdAt: 0 })], [], "routine", "it").map(t => t.id)).toEqual([1, 2]);
  });

  it("recognizes collections and follows reordered groups immediately", () => {
    expect(routineTaskOrder(task(1, "Manuale", { collectionId: 4 }), routine)).toBe(2);
    const reordered = { ...routine, groups: [...routine.groups].reverse() };
    expect(routineTaskOrder(task(1, "Manuale", { collectionId: 4 }), reordered)).toBe(0);
    expect(routineTaskOrder(task(1, "Rimosso", { itemId: 99 }), routine)).toBe(Infinity);
  });

  it("keeps the existing task order within each group regardless of pool order", () => {
    const r = { ...routine, groups: [{ id: "g", name: "G", pool: [{ type: "item" as const, id: 2 }, { type: "item" as const, id: 1 }] }] };
    const tasks = [task(1, "B", { studyRoutineId: 1, itemId: 1 }), task(2, "A", { studyRoutineId: 1, itemId: 2 })];
    expect(sortDiaryTasks(tasks, [r], "routine", "it").map(t => t.id)).toEqual([1, 2]);
  });

  it("keeps groups in sequence when a task is completed", () => {
    const tasks = [task(1, "Arpeggi", { studyRoutineId: 1, itemId: 3 }),
      task(2, "Scale", { studyRoutineId: 1, itemId: 2, done: true })];
    expect(sortDiaryTasks(tasks, [routine], "routine", "it").map(t => t.id)).toEqual([2, 1]);
  });
});
