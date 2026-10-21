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
    const lessonId = await lessonsService.log(1, null, "2025-03-01", []);
    const lesson = await db.lessons.get(lessonId);
    expect(lesson).toBeDefined();
    expect(lesson!.date).toBe("2025-03-01");
    expect(lesson!.subjectId).toBe(1);
    expect(await db.assignments.count()).toBe(0);
  });

  it("creates a lesson and bulk-inserts assignments atomically", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", [
      "Practice scales",
      "Work on dynamics",
    ]);

    const lesson = await db.lessons.get(lessonId);
    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    expect(assignments).toHaveLength(2);
    expect(assignments.map((a) => a.text).sort()).toEqual(["Practice scales", "Work on dynamics"]);
    expect(assignments[0].taskIds).toEqual([]);
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

  it("creates one lesson when called concurrently", async () => {
    const [a, b] = await Promise.all([lessonsService.ensureFor(1, null, "2025-04-01"), lessonsService.ensureFor(1, null, "2025-04-01")]);
    expect(a).toBe(b);
    expect(await db.lessons.count()).toBe(1);
  });

  it("log() keeps the lesson created by earlier homework", async () => {
    const recurrence = { id: 6, subjectId: 1, teacher: "T", schedules: [], startDate: "2025-01-01", color: "blue" as const, createdAt: 1 };
    const id = await lessonsService.ensureFor(1, recurrence, "2025-03-05");
    await lessonsService.addAssignment(id, "Arpeggios");

    const logged = await lessonsService.log(1, recurrence, "2025-03-05");

    expect(logged).toBe(id);
    expect(await db.assignments.where("lessonId").equals(id).count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// notes list / setDate
// ---------------------------------------------------------------------------

describe("lessonsService notes and date", () => {
  it("addNote trims and stores", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    const noteId = await lessonsService.addNote(id, "  Watch the left hand  ");
    expect(noteId).toBeTruthy();
    expect((await db.lessons.get(id))!.notes).toEqual([{ id: noteId, text: "Watch the left hand" }]);
  });

  it("addNote ignores blank", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    expect(await lessonsService.addNote(id, "   ")).toBe("");
    expect((await db.lessons.get(id))!.notes ?? []).toEqual([]);
  });

  it("updateNote changes only that note", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    const a = await lessonsService.addNote(id, "A");
    const b = await lessonsService.addNote(id, "B");
    await lessonsService.updateNote(id, a, "A2");
    await lessonsService.updateNote(id, b, "  ");
    expect((await db.lessons.get(id))!.notes).toEqual([{ id: a, text: "A2" }, { id: b, text: "B" }]);
  });

  it("removeNote leaves the others", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    const a = await lessonsService.addNote(id, "A");
    const b = await lessonsService.addNote(id, "B");
    await lessonsService.removeNote(id, a);
    expect((await db.lessons.get(id))!.notes).toEqual([{ id: b, text: "B" }]);
  });

  it("reinsertNote puts the same note back at its position, once", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    const a = await lessonsService.addNote(id, "A");
    const b = await lessonsService.addNote(id, "B");
    await lessonsService.removeNote(id, a);
    await lessonsService.reinsertNote(id, { id: a, text: "A" }, 0);
    await lessonsService.reinsertNote(id, { id: a, text: "A" }, 0);
    expect((await db.lessons.get(id))!.notes).toEqual([{ id: a, text: "A" }, { id: b, text: "B" }]);
  });

  it("note writes on a legacy string row start a fresh list instead of spreading the string", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    const legacy = () => db.lessons.update(id, { notes: "old text" as never });
    const notes = async () => (await db.lessons.get(id))!.notes;
    await legacy(); await lessonsService.updateNote(id, "x", "X");
    expect(await notes()).toEqual([]);
    await legacy(); await lessonsService.removeNote(id, "x");
    expect(await notes()).toEqual([]);
    await legacy(); await lessonsService.reinsertNote(id, { id: "r", text: "R" }, 0);
    expect(await notes()).toEqual([{ id: "r", text: "R" }]);
    await legacy(); const a = await lessonsService.addNote(id, "A");
    expect(await notes()).toEqual([{ id: a, text: "A" }]);
  });

  it("reinsertAssignment brings the removed record back unchanged", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    const assignmentId = await lessonsService.addAssignment(id, "Scales");
    await lessonsService.linkTask(assignmentId, 7);
    await lessonsService.ignoreAssignment(assignmentId);
    const before = (await db.assignments.get(assignmentId))!;
    await lessonsService.removeAssignment(assignmentId);
    await lessonsService.reinsertAssignment(before);
    expect(await db.assignments.toArray()).toEqual([before]);
  });

  it("setDate moves the lesson", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    await lessonsService.setDate(id, "2025-03-02");
    expect((await db.lessons.get(id))!.date).toBe("2025-03-02");
  });

  it("setDate refuses a same slot and day", async () => {
    const id = await lessonsService.ensureFor(1, null, "2025-03-01");
    await lessonsService.ensureFor(1, null, "2025-03-02");
    await expect(lessonsService.setDate(id, "2025-03-02")).rejects.toThrow("lesson-exists");
    expect((await db.lessons.get(id))!.date).toBe("2025-03-01");
  });
});

// ---------------------------------------------------------------------------
// deleteLesson
// ---------------------------------------------------------------------------

describe("lessonsService.deleteLesson", () => {
  it("deletes the lesson and all its assignments atomically", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", [
      "Do this",
      "Do that",
    ]);

    await lessonsService.deleteLesson(lessonId);

    expect(await db.lessons.get(lessonId)).toBeUndefined();
    expect(await db.assignments.where("lessonId").equals(lessonId).count()).toBe(0);
  });

  it("does not delete assignments from other lessons", async () => {
    const id1 = await lessonsService.log(1, null, "2025-03-01", ["A1"]);
    const id2 = await lessonsService.log(1, null, "2025-03-08", ["A2"]);

    await lessonsService.deleteLesson(id1);

    expect(await db.assignments.where("lessonId").equals(id2).count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ignoreAssignment / restoreAssignment
// ---------------------------------------------------------------------------

describe("lessonsService.ignoreAssignment / restoreAssignment", () => {
  it("sets ignored=true then false", async () => {
    const lessonId = await lessonsService.log(1, null, "2025-03-01", ["Practice"]);
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
    const lessonId = await lessonsService.log(1, null, "2025-03-01", ["Scales"]);
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
    const lessonId = await lessonsService.log(1, null, "2025-03-01", ["A", "B"]);
    const assignments = await db.assignments.where("lessonId").equals(lessonId).toArray();
    const taskId = (await db.tasks.add({
      subjectId: 1, title: "A", date: "2025-03-02", plan: [], done: false, createdAt: Date.now(),
    })) as number;

    await lessonsService.linkTask(assignments[0].id!, taskId);

    const other = await db.assignments.get(assignments[1].id!);
    expect(other!.taskIds).toEqual([]);
  });
});
