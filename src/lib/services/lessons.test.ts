import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { lessonsService } from "@/lib/services/lessons";

beforeEach(async () => {
  await db.delete();
  await db.open();
  // Seed a subject so buildLessonSnapshot can find it
  await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1_000_000 });
});

async function seedRecurrence() {
  return (await db.recurrences.add({
    subjectId: 1,
    teacher: "Maestro",
    schedules: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00", frequency: "weekly" }],
    startDate: "2025-01-01",
    color: "terracotta",
    createdAt: 1_000_000,
  })) as number;
}

// ---------------------------------------------------------------------------
// upsertRecurrence
// ---------------------------------------------------------------------------

describe("lessonsService.upsertRecurrence", () => {
  const base = {
    subjectId: 1,
    teacher: "Maestro",
    schedules: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00", frequency: "weekly" as const }],
    startDate: "2025-01-01",
    color: "terracotta" as const,
    createdAt: 1_000_000,
  };


  it("inserts a new recurrence when no id is provided", async () => {
    const id = await lessonsService.upsertRecurrence(base);
    const rec = await db.recurrences.get(id);
    expect(rec).toBeDefined();
    expect(rec!.teacher).toBe("Maestro");
  });

  it("updates an existing recurrence when id is provided", async () => {
    const id = await seedRecurrence();
    await lessonsService.upsertRecurrence({ ...base, teacher: "New Teacher" }, id);
    const rec = await db.recurrences.get(id);
    expect(rec!.teacher).toBe("New Teacher");
    expect(await db.recurrences.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// deleteRecurrence
// ---------------------------------------------------------------------------

describe("lessonsService.deleteRecurrence", () => {
  it("hard-deletes the recurrence", async () => {
    const id = await seedRecurrence();
    await lessonsService.deleteRecurrence(id);
    expect(await db.recurrences.get(id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

describe("lessonsService.log", () => {
  it("creates a lesson with no assignments", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, []);
    const lesson = await db.lessons.get(lessonId);
    expect(lesson).toBeDefined();
    expect(lesson!.date).toBe("2025-03-01");
    expect(lesson!.subjectId).toBe(1);
    expect(await db.assignments.count()).toBe(0);
  });

  it("creates a lesson and bulk-inserts assignments atomically", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", "Good session", [
      "Practice scales",
      "Work on dynamics",
    ]);

    const lesson = await db.lessons.get(lessonId);
    expect(lesson!.notes).toBe("Good session");

    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    expect(assignments).toHaveLength(2);
    expect(assignments.map((a) => a.text).sort()).toEqual(["Practice scales", "Work on dynamics"]);
    expect(assignments[0].taskIds).toEqual([]);
  });

  it("trims whitespace from notes and leaves undefined when empty", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", "  ", []);
    const lesson = await db.lessons.get(lessonId);
    expect(lesson!.notes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateLesson
// ---------------------------------------------------------------------------

describe("lessonsService.updateLesson", () => {
  it("updates date and notes and leaves the assignments alone", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", "Old notes", ["Keep me"]);
    const lesson = (await db.lessons.get(lessonId))!;

    await lessonsService.updateLesson(lesson, "2025-03-02", "New notes");

    const updated = await db.lessons.get(lessonId);
    expect(updated!.date).toBe("2025-03-02");
    expect(updated!.notes).toBe("New notes");
    expect((await db.assignments.where("lessonId").equals(lessonId).toArray()).map((a) => a.text)).toEqual(["Keep me"]);
  });
});

// ---------------------------------------------------------------------------
// ensureFor / addAssignment — homework captured live
// ---------------------------------------------------------------------------

describe("lessonsService.ensureFor", () => {
  it("creates the lesson once per slot and day and attaches homework to it", async () => {
    const recurrence = { id: 5, subjectId: 1, teacher: "T", schedules: [], startDate: "2025-01-01", color: "blue" as const, createdAt: 1 };
    const first = await lessonsService.ensureFor(1, recurrence, "2025-03-05");
    const again = await lessonsService.ensureFor(1, recurrence, "2025-03-05");
    const other = await lessonsService.ensureFor(1, recurrence, "2025-03-12");

    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(await db.lessons.count()).toBe(2);

    await lessonsService.addAssignment(first, "  Scales at 80  ");
    await lessonsService.addAssignment(first, "   ");
    const rows = await db.assignments.where("lessonId").equals(first).toArray();
    expect(rows.map((a) => a.text)).toEqual(["Scales at 80"]);
    expect(rows[0].taskIds).toEqual([]);
  });

  it("log() keeps the lesson created by earlier homework and sets its notes", async () => {
    const recurrence = { id: 6, subjectId: 1, teacher: "T", schedules: [], startDate: "2025-01-01", color: "blue" as const, createdAt: 1 };
    const id = await lessonsService.ensureFor(1, recurrence, "2025-03-05");
    await lessonsService.addAssignment(id, "Arpeggios");

    const logged = await lessonsService.log(1, recurrence, "2025-03-05", "Good lesson");

    expect(logged).toBe(id);
    expect((await db.lessons.get(id))!.notes).toBe("Good lesson");
    expect(await db.assignments.where("lessonId").equals(id).count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// deleteLesson
// ---------------------------------------------------------------------------

describe("lessonsService.deleteLesson", () => {
  it("deletes the lesson and all its assignments atomically", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, [
      "Do this",
      "Do that",
    ]);

    await lessonsService.deleteLesson(lessonId);

    expect(await db.lessons.get(lessonId)).toBeUndefined();
    expect(await db.assignments.where("lessonId").equals(lessonId).count()).toBe(0);
  });

  it("does not delete assignments from other lessons", async () => {
    const id1 = await lessonsService.log(1, null, "2025-03-01", undefined, ["A1"]);
    const id2 = await lessonsService.log(1, null, "2025-03-08", undefined, ["A2"]);

    await lessonsService.deleteLesson(id1);

    expect(await db.assignments.where("lessonId").equals(id2).count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ignoreAssignment / restoreAssignment
// ---------------------------------------------------------------------------

describe("lessonsService.ignoreAssignment / restoreAssignment", () => {
  it("sets ignored=true then false", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, ["Practice"]);
    const [assignment] = await db.assignments.where("lessonId").equals(lessonId).toArray();
    const id = assignment.id!;

    await lessonsService.ignoreAssignment(id);
    expect((await db.assignments.get(id))!.ignored).toBe(true);

    await lessonsService.restoreAssignment(id);
    expect((await db.assignments.get(id))!.ignored).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transformAssignment
// ---------------------------------------------------------------------------

describe("lessonsService.linkTask", () => {
  it("links the assignment to a task, once per task", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, ["Scales"]);
    const [assignment] = await db.assignments.where("lessonId").equals(lessonId).toArray();
    const id = assignment.id!;
    const taskId = (await db.tasks.add({
      subjectId: 1, title: "Scales", date: "2025-03-02", plan: [], done: false, createdAt: Date.now(),
    })) as number;

    await lessonsService.linkTask(id, taskId);
    await lessonsService.linkTask(id, taskId);

    const updated = (await db.assignments.get(id))!;
    expect(updated.taskIds).toEqual([taskId]);
    expect(await db.assignments.where("taskIds").equals(taskId).count()).toBe(1);

    await lessonsService.unlinkTask(id, taskId);
    expect((await db.assignments.get(id))!.taskIds).toEqual([]);
  });

  it("does not mutate other assignments on the same lesson", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, ["A", "B"]);
    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    const taskId = (await db.tasks.add({
      subjectId: 1, title: "A", date: "2025-03-02", plan: [], done: false, createdAt: Date.now(),
    })) as number;

    await lessonsService.linkTask(assignments[0].id!, taskId);

    const other = await db.assignments.get(assignments[1].id!);
    expect(other!.taskIds).toEqual([]);
  });
});
