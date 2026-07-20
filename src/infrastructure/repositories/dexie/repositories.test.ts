import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { taskRepository } from "./taskRepository";
import { sessionRepository } from "./sessionRepository";
import { backupRepository } from "./backupRepository";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function subjectId() {
  return db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 }) as Promise<number>;
}

describe("Dexie repositories", () => {
  it("lists only active tasks", async () => {
    const subject = await subjectId();
    await db.tasks.bulkAdd([
      { title: "active", date: "2026-01-01", subjectId: subject, done: false, createdAt: 1 },
      { title: "deleted", date: "2026-01-01", subjectId: subject, done: false, createdAt: 1, deletedAt: 2 },
    ]);
    expect((await taskRepository.list()).map((task) => task.title)).toEqual(["active"]);
  });

  it("soft-deletes tasks with sessions and hard-deletes tasks without sessions", async () => {
    const subject = await subjectId();
    const soft = await taskRepository.create({ title: "soft", date: "2026-01-01", subjectId: subject });
    const hard = await taskRepository.create({ title: "hard", date: "2026-01-01", subjectId: subject });
    await db.sessions.add({ id: 1, taskId: soft, date: "2026-01-01", createdAt: 1 });
    expect(await taskRepository.remove(soft)).toBe("soft");
    expect(await taskRepository.remove(hard)).toBe("hard");
    expect((await db.tasks.get(soft))?.deletedAt).toBeTypeOf("number");
    expect(await db.tasks.get(hard)).toBeUndefined();
  });

  it("bulk removal reports soft and hard totals", async () => {
    const subject = await subjectId();
    const soft = await taskRepository.create({ title: "soft", date: "2026-01-01", subjectId: subject });
    const hard = await taskRepository.create({ title: "hard", date: "2026-01-01", subjectId: subject });
    await db.sessions.add({ id: 1, taskId: soft, date: "2026-01-01", createdAt: 1 });
    expect(await taskRepository.bulkRemove([soft, hard])).toEqual({ soft: 1, hard: 1 });
  });

  it("writes recurrence atomically", async () => {
    const subject = await subjectId();
    const original = db.tasks.bulkAdd;
    db.tasks.bulkAdd = (() => Promise.reject(new Error("second write fails"))) as typeof db.tasks.bulkAdd;
    await expect(taskRepository.create({ title: "repeat", date: "2026-01-01", subjectId: subject, recurrence: { kind: "interval", startDate: "2026-01-01", occurrences: 2 } })).rejects.toThrow("second write fails");
    db.tasks.bulkAdd = original;
    expect(await db.tasks.count()).toBe(0);
  });

  it("logs immutable session snapshot and completes task", async () => {
    const subject = await subjectId();
    const taskId = await taskRepository.create({ title: "Scales", date: "2026-01-01", subjectId: subject });
    const task = (await db.tasks.get(taskId))!;
    const id = await sessionRepository.logWithCompletion(task, { date: "2026-01-01", layersUsed: [], techniquesUsed: [] });
    expect((await db.sessions.get(id))?.snapshot?.taskTitle).toBe("Scales");
    expect((await db.tasks.get(taskId))?.done).toBe(true);
  });

  it("rolls back session and task completion when help logging fails", async () => {
    const subject = await subjectId();
    const taskId = await taskRepository.create({ title: "Scales", date: "2026-01-01", subjectId: subject });
    const task = (await db.tasks.get(taskId))!;
    const original = db.helpRequests.add;
    db.helpRequests.add = (() => Promise.reject(new Error("help fails"))) as typeof db.helpRequests.add;
    await expect(sessionRepository.logWithCompletion(task, { date: "2026-01-01", layersUsed: [], techniquesUsed: [], helpText: "help" })).rejects.toThrow("help fails");
    db.helpRequests.add = original;
    expect(await db.sessions.count()).toBe(0);
    expect((await db.tasks.get(taskId))?.done).toBe(false);
  });

  it("rolls back backup import when a later table write fails", async () => {
    await db.subjects.add({ name: "old", type: "instrument", createdAt: 1 });
    await expect(backupRepository.importAll(JSON.stringify({ version: 2, data: {
      subjects: [{ name: "new", type: "instrument", createdAt: 2 }],
      library: [
        { id: 1, subjectId: 1, kind: "repertoire", title: "first", createdAt: 2 },
        { id: 1, subjectId: 1, kind: "repertoire", title: "duplicate", createdAt: 2 },
      ],
    } }))).rejects.toThrow();
    expect((await db.subjects.toArray()).map((subject) => subject.name)).toEqual(["old"]);
  });
});
