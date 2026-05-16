import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { tasksService } from "@/lib/services/tasks";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedSubject() {
  return (await db.subjects.add({
    name: "Piano",
    type: "instrument" as const,
    createdAt: 1_000_000,
  })) as number;
}

// ---------------------------------------------------------------------------
// Create — no recurrence
// ---------------------------------------------------------------------------

describe("tasksService.create — no recurrence", () => {
  it("creates exactly one task with correct fields", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({
      title: "Scales",
      date: "2025-03-01",
      subjectId,
    });
    const task = await db.tasks.get(id);
    expect(task).toBeDefined();
    expect(task!.title).toBe("Scales");
    expect(task!.date).toBe("2025-03-01");
    expect(task!.done).toBe(false);
    expect(task!.subjectId).toBe(subjectId);
    expect(task!.recurrenceTaskId).toBeUndefined();
    expect(task!.recurrence).toBeUndefined();
    expect(await db.tasks.count()).toBe(1);
  });

  it("stores optional fields when provided", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({
      title: "Etude",
      date: "2025-03-01",
      subjectId,
      targetBpm: 120,
      noteVal: "quarter",
      layers: ["aural"],
    });
    const task = await db.tasks.get(id);
    expect(task!.targetBpm).toBe(120);
    expect(task!.noteVal).toBe("quarter");
    expect(task!.layers).toEqual(["aural"]);
  });
});

// ---------------------------------------------------------------------------
// Create — weekdays recurrence
// ---------------------------------------------------------------------------

describe("tasksService.create — weekdays recurrence", () => {
  it("creates one task per matching day within the date range", async () => {
    const subjectId = await seedSubject();
    const firstId = await tasksService.create({
      title: "Etude",
      date: "2025-01-06",
      subjectId,
      recurrence: {
        kind: "weekdays",
        days: [1, 3], // Mon, Wed
        startDate: "2025-01-06",
        endDate: "2025-01-15",
      },
    });
    // Mon Jan 6, Wed Jan 8, Mon Jan 13, Wed Jan 15
    expect(await db.tasks.count()).toBe(4);

    const first = await db.tasks.get(firstId);
    expect(first!.date).toBe("2025-01-06");
    expect(first!.recurrence).toBeDefined();
    expect(first!.recurrence!.kind).toBe("weekdays");
    expect(first!.recurrenceTaskId).toBeUndefined();

    const children = await db.tasks.where("recurrenceTaskId").equals(firstId).toArray();
    expect(children).toHaveLength(3);
    const dates = children.map((t) => t.date).sort();
    expect(dates).toEqual(["2025-01-08", "2025-01-13", "2025-01-15"]);
  });

  it("child tasks inherit task fields but not recurrence property", async () => {
    const subjectId = await seedSubject();
    const firstId = await tasksService.create({
      title: "Arpeggios",
      date: "2025-01-06",
      subjectId,
      targetBpm: 80,
      recurrence: {
        kind: "weekdays",
        days: [1],
        startDate: "2025-01-06",
        occurrences: 3,
      },
    });
    const children = await db.tasks.where("recurrenceTaskId").equals(firstId).toArray();
    expect(children).toHaveLength(2);
    for (const child of children) {
      expect(child.title).toBe("Arpeggios");
      expect(child.targetBpm).toBe(80);
      expect(child.subjectId).toBe(subjectId);
      expect(child.recurrence).toBeUndefined();
      expect(child.recurrenceTaskId).toBe(firstId);
    }
  });

  it("throws when no days are specified", async () => {
    const subjectId = await seedSubject();
    await expect(
      tasksService.create({
        title: "Etude",
        date: "2025-01-01",
        subjectId,
        recurrence: { kind: "weekdays", days: [], startDate: "2025-01-01" },
      }),
    ).rejects.toThrow("Recurrence produced no dates");
    expect(await db.tasks.count()).toBe(0);
  });

  it("respects occurrences cap", async () => {
    const subjectId = await seedSubject();
    const firstId = await tasksService.create({
      title: "Piece",
      date: "2025-01-01",
      subjectId,
      recurrence: {
        kind: "weekdays",
        days: [0, 1, 2, 3, 4, 5, 6],
        startDate: "2025-01-01",
        occurrences: 5,
      },
    });
    expect(await db.tasks.count()).toBe(5);
    const children = await db.tasks.where("recurrenceTaskId").equals(firstId).toArray();
    expect(children).toHaveLength(4);
  });

  it("single occurrence creates one task with recurrence, no children", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({
      title: "Solo",
      date: "2025-01-06",
      subjectId,
      recurrence: {
        kind: "weekdays",
        days: [1],
        startDate: "2025-01-06",
        occurrences: 1,
      },
    });
    expect(await db.tasks.count()).toBe(1);
    const task = await db.tasks.get(id);
    expect(task!.recurrence).toBeDefined();
    expect(task!.recurrenceTaskId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Create — interval recurrence
// ---------------------------------------------------------------------------

describe("tasksService.create — interval recurrence", () => {
  it("creates tasks at the specified interval", async () => {
    const subjectId = await seedSubject();
    const firstId = await tasksService.create({
      title: "Exercise",
      date: "2025-01-01",
      subjectId,
      recurrence: {
        kind: "interval",
        everyXDays: 7,
        startDate: "2025-01-01",
        occurrences: 4,
      },
    });
    expect(await db.tasks.count()).toBe(4);
    const first = await db.tasks.get(firstId);
    expect(first!.date).toBe("2025-01-01");
    expect(first!.recurrence).toBeDefined();

    const children = await db.tasks.where("recurrenceTaskId").equals(firstId).toArray();
    expect(children).toHaveLength(3);
    const dates = children.map((t) => t.date).sort();
    expect(dates).toEqual(["2025-01-08", "2025-01-15", "2025-01-22"]);
  });

  it("defaults everyXDays to 1 when undefined", async () => {
    const subjectId = await seedSubject();
    await tasksService.create({
      title: "Daily",
      date: "2025-01-01",
      subjectId,
      recurrence: {
        kind: "interval",
        startDate: "2025-01-01",
        occurrences: 3,
      },
    });
    const tasks = await db.tasks.toArray();
    const dates = tasks.map((t) => t.date).sort();
    expect(dates).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
  });

  it("respects endDate boundary", async () => {
    const subjectId = await seedSubject();
    await tasksService.create({
      title: "Bounded",
      date: "2025-01-01",
      subjectId,
      recurrence: {
        kind: "interval",
        everyXDays: 3,
        startDate: "2025-01-01",
        endDate: "2025-01-10",
      },
    });
    const tasks = await db.tasks.toArray();
    const dates = tasks.map((t) => t.date).sort();
    expect(dates).toEqual(["2025-01-01", "2025-01-04", "2025-01-07", "2025-01-10"]);
  });
});

// ---------------------------------------------------------------------------
// byDate
// ---------------------------------------------------------------------------

describe("tasksService.byDate", () => {
  it("returns only tasks for the given date", async () => {
    const subjectId = await seedSubject();
    await tasksService.create({ title: "A", date: "2025-01-01", subjectId });
    await tasksService.create({ title: "B", date: "2025-01-02", subjectId });
    await tasksService.create({ title: "C", date: "2025-01-01", subjectId });

    const jan1 = await tasksService.byDate("2025-01-01");
    expect(jan1.map((t) => t.title).sort()).toEqual(["A", "C"]);

    const jan2 = await tasksService.byDate("2025-01-02");
    expect(jan2.map((t) => t.title)).toEqual(["B"]);
  });

  it("excludes soft-deleted tasks", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({ title: "Deleted", date: "2025-01-01", subjectId });
    await db.tasks.update(id, { deletedAt: Date.now() });
    expect(await tasksService.byDate("2025-01-01")).toHaveLength(0);
  });

  it("returns empty array for a date with no tasks", async () => {
    expect(await tasksService.byDate("2025-01-01")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe("tasksService.list", () => {
  it("returns all non-deleted tasks across dates", async () => {
    const subjectId = await seedSubject();
    await tasksService.create({ title: "A", date: "2025-01-01", subjectId });
    await tasksService.create({ title: "B", date: "2025-06-15", subjectId });
    const tasks = await tasksService.list();
    expect(tasks).toHaveLength(2);
  });

  it("excludes soft-deleted tasks", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({ title: "Keep", date: "2025-01-01", subjectId });
    await tasksService.create({ title: "Active", date: "2025-01-01", subjectId });
    await db.tasks.update(id, { deletedAt: Date.now() });
    const tasks = await tasksService.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Active");
  });
});

// ---------------------------------------------------------------------------
// toggleDone
// ---------------------------------------------------------------------------

describe("tasksService.toggleDone", () => {
  it("marks a task done then undone", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({ title: "Practice", date: "2025-01-01", subjectId });
    expect((await db.tasks.get(id))!.done).toBe(false);

    await tasksService.toggleDone(id, true);
    expect((await db.tasks.get(id))!.done).toBe(true);

    await tasksService.toggleDone(id, false);
    expect((await db.tasks.get(id))!.done).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("tasksService.update", () => {
  it("patches specified fields without touching others", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({
      title: "Old title",
      date: "2025-01-01",
      subjectId,
      targetBpm: 80,
    });
    await tasksService.update(id, { title: "New title", targetBpm: 120 });
    const task = await db.tasks.get(id);
    expect(task!.title).toBe("New title");
    expect(task!.targetBpm).toBe(120);
    expect(task!.date).toBe("2025-01-01");
    expect(task!.subjectId).toBe(subjectId);
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("tasksService.remove", () => {
  it("hard-deletes a task that has no sessions", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({ title: "No sessions", date: "2025-01-01", subjectId });
    const result = await tasksService.remove(id);
    expect(result).toBe("hard");
    expect(await db.tasks.get(id)).toBeUndefined();
  });

  it("soft-deletes a task that has at least one session", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({ title: "Has session", date: "2025-01-01", subjectId });
    await db.sessions.add({ taskId: id, date: "2025-01-01", quality: "well", createdAt: Date.now() });
    const result = await tasksService.remove(id);
    expect(result).toBe("soft");
    const task = await db.tasks.get(id);
    expect(task).toBeDefined();
    expect(task!.deletedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// bulkRemove
// ---------------------------------------------------------------------------

describe("tasksService.bulkRemove", () => {
  it("returns zeros for empty input", async () => {
    expect(await tasksService.bulkRemove([])).toEqual({ soft: 0, hard: 0 });
  });

  it("hard-deletes tasks without sessions", async () => {
    const subjectId = await seedSubject();
    const id1 = await tasksService.create({ title: "A", date: "2025-01-01", subjectId });
    const id2 = await tasksService.create({ title: "B", date: "2025-01-02", subjectId });
    const result = await tasksService.bulkRemove([id1, id2]);
    expect(result).toEqual({ soft: 0, hard: 2 });
    expect(await db.tasks.get(id1)).toBeUndefined();
    expect(await db.tasks.get(id2)).toBeUndefined();
  });

  it("soft-deletes tasks that have sessions", async () => {
    const subjectId = await seedSubject();
    const id = await tasksService.create({ title: "With session", date: "2025-01-01", subjectId });
    await db.sessions.add({ taskId: id, date: "2025-01-01", quality: "hard", createdAt: Date.now() });
    const result = await tasksService.bulkRemove([id]);
    expect(result).toEqual({ soft: 1, hard: 0 });
    expect((await db.tasks.get(id))!.deletedAt).toBeDefined();
  });

  it("mixes soft and hard deletes correctly", async () => {
    const subjectId = await seedSubject();
    const hardId = await tasksService.create({ title: "No session", date: "2025-01-01", subjectId });
    const softId = await tasksService.create({ title: "Has session", date: "2025-01-02", subjectId });
    await db.sessions.add({ taskId: softId, date: "2025-01-02", quality: "well", createdAt: Date.now() });

    const result = await tasksService.bulkRemove([hardId, softId]);
    expect(result.hard).toBe(1);
    expect(result.soft).toBe(1);
    expect(await db.tasks.get(hardId)).toBeUndefined();
    const softTask = await db.tasks.get(softId);
    expect(softTask!.deletedAt).toBeDefined();
  });
});
