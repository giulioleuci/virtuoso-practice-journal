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
    frequency: "weekly",
    dayOfWeek: 1,
    startTime: "17:00",
    endTime: "18:00",
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
    frequency: "weekly" as const,
    dayOfWeek: 1,
    startTime: "17:00",
    endTime: "18:00",
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
    expect(assignments[0].transformed).toBe(false);
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
  it("updates date and notes, replacing assignments", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", "Old notes", [
      "Old assignment",
    ]);
    const lesson = (await db.lessons.get(lessonId))!;

    await lessonsService.updateLesson(lesson, "2025-03-02", "New notes", ["New assignment"]);

    const updated = await db.lessons.get(lessonId);
    expect(updated!.date).toBe("2025-03-02");
    expect(updated!.notes).toBe("New notes");

    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    expect(assignments).toHaveLength(1);
    expect(assignments[0].text).toBe("New assignment");
  });

  it("removes all assignments when new list is empty", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, [
      "Assignment A",
      "Assignment B",
    ]);
    const lesson = (await db.lessons.get(lessonId))!;

    await lessonsService.updateLesson(lesson, "2025-03-01", undefined, []);

    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    expect(assignments).toHaveLength(0);
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

describe("lessonsService.transformAssignment", () => {
  it("marks the assignment as transformed and links it to a task", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, ["Scales"]);
    const [assignment] = await db.assignments.where("lessonId").equals(lessonId).toArray();
    const id = assignment.id!;
    const taskId = (await db.tasks.add({
      subjectId: 1, title: "Scales", date: "2025-03-02", done: false, createdAt: Date.now(),
    })) as number;

    await lessonsService.transformAssignment(id, taskId);

    const updated = (await db.assignments.get(id))!;
    expect(updated.transformed).toBe(true);
    expect(updated.taskId).toBe(taskId);
  });

  it("does not mutate other assignments on the same lesson", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", undefined, ["A", "B"]);
    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    const taskId = (await db.tasks.add({
      subjectId: 1, title: "A", date: "2025-03-02", done: false, createdAt: Date.now(),
    })) as number;

    await lessonsService.transformAssignment(assignments[0].id!, taskId);

    const other = await db.assignments.get(assignments[1].id!);
    expect(other!.transformed).toBe(false);
    expect(other!.taskId).toBeUndefined();
  });
});
