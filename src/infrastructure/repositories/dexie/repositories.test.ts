import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { taskRepository } from "./taskRepository";
import { sessionRepository } from "./sessionRepository";
import { backupRepository } from "./backupRepository";
import { libraryRepository } from "./libraryRepository";
import { collectionRepository } from "./collectionRepository";
import { lessonRepository } from "./lessonRepository";
import { profileRepository } from "./profileRepository";
import { studyRoutineRepository } from "./studyRoutineRepository";
import { LogSessionUseCase } from "@/application/useCases/logSession";

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
    db.tasks.bulkAdd = (() => Promise.reject(new Error("second write fails"))) as unknown as typeof db.tasks.bulkAdd;
    await expect(taskRepository.create({ title: "repeat", date: "2026-01-01", subjectId: subject, recurrence: { kind: "interval", startDate: "2026-01-01", occurrences: 2 } })).rejects.toThrow("second write fails");
    db.tasks.bulkAdd = original;
    expect(await db.tasks.count()).toBe(0);
  });

  it("logs immutable session snapshot and completes task", async () => {
    const subject = await subjectId();
    const taskId = await taskRepository.create({ title: "Scales", date: "2026-01-01", subjectId: subject });
    const task = (await db.tasks.get(taskId))!;
    const id = await new LogSessionUseCase(sessionRepository, () => 1).execute(task, { date: "2026-01-01", layersUsed: [], techniquesUsed: [] });
    expect((await db.sessions.get(id))?.snapshot?.taskTitle).toBe("Scales");
    expect((await db.tasks.get(taskId))?.done).toBe(true);
  });

  it("rolls back session and task completion when help logging fails", async () => {
    const subject = await subjectId();
    const taskId = await taskRepository.create({ title: "Scales", date: "2026-01-01", subjectId: subject });
    const task = (await db.tasks.get(taskId))!;
    const original = db.helpRequests.add;
    db.helpRequests.add = (() => Promise.reject(new Error("help fails"))) as unknown as typeof db.helpRequests.add;
    await expect(new LogSessionUseCase(sessionRepository, () => 1).execute(task, { date: "2026-01-01", layersUsed: [], techniquesUsed: [], helpText: "help" })).rejects.toThrow("help fails");
    db.helpRequests.add = original;
    expect(await db.sessions.count()).toBe(0);
    expect((await db.tasks.get(taskId))?.done).toBe(false);
  });

  it("rolls back backup import when a later bulk add fails", async () => {
    const originalSubjectId = await db.subjects.add({ name: "old subject", type: "instrument", createdAt: 1 });
    await db.library.add({ subjectId: originalSubjectId, kind: "repertoire", title: "old item", createdAt: 1 });
    const libraryTable = db.tables.find((table) => table.name === "library");
    if (!libraryTable) throw new Error("library table missing");
    vi.spyOn(libraryTable, "bulkAdd").mockRejectedValueOnce(new Error("library import fails"));

    await expect(backupRepository.importAll({
      subjects: [{ name: "new subject", type: "instrument", createdAt: 2 }],
      library: [{ subjectId: originalSubjectId, kind: "repertoire", title: "new item", createdAt: 2 }],
    })).rejects.toThrow("library import fails");

    expect((await db.subjects.toArray()).map((subject) => subject.name)).toEqual(["old subject"]);
    expect((await db.library.toArray()).map((item) => item.title)).toEqual(["old item"]);
  });

  it("implements collection links port and excludes deleted library items", async () => {
    const subject = await subjectId();
    const collectionId = await collectionRepository.create({ kind: "repertoire", name: "Set", createdAt: 1, updatedAt: 1 });
    const activeItem = await db.library.add({ subjectId: subject, kind: "repertoire", title: "active", createdAt: 1 });
    const deletedItem = await db.library.add({ subjectId: subject, kind: "repertoire", title: "deleted", deletedAt: 2, createdAt: 1 });
    await db.collectionItems.bulkAdd([
      { collectionId, itemId: activeItem, createdAt: 1 },
      { collectionId, itemId: deletedItem, createdAt: 1 },
    ]);
    expect((await collectionRepository.items(collectionId)).map((link) => link.itemId)).toEqual([activeItem, deletedItem]);
    expect((await collectionRepository.listItems(collectionId)).map((item) => item.title)).toEqual(["active"]);
  });

  it("implements lesson port reads, updates, and assignment lookup", async () => {
    const subject = await subjectId();
    const lessonId = await lessonRepository.log(subject, undefined, "2026-01-01", "note", ["practice"]);
    expect((await lessonRepository.list()).map((lesson) => lesson.id)).toEqual([lessonId]);
    expect((await lessonRepository.get(lessonId))?.notes).toBe("note");
    expect((await lessonRepository.assignmentsForLesson(lessonId)).map((assignment) => assignment.text)).toEqual(["practice"]);
    await lessonRepository.update(lessonId, { notes: "updated" });
    expect((await lessonRepository.get(lessonId))?.notes).toBe("updated");
    await lessonRepository.remove(lessonId);
    expect(await lessonRepository.get(lessonId)).toBeUndefined();
  });

  it("returns initialized profile and rolls back its subjects when profile write fails", async () => {
    const profile = await profileRepository.initialize({ subjects: [{ name: "Piano", type: "instrument" }], name: "Alice", lang: "en", reminderTime: "09:00", reminderFreq: "daily", reminderDays: [], lateRecoveryDays: 1, graceDay: false, groupByPhase: false, onboarded: true });
    expect(profile.id).toBe("me");
    expect(await db.subjects.count()).toBe(1);
  });

  it("rolls back earlier subjects when the second onboarding subject write fails", async () => {
    const add = vi.spyOn(db.subjects, "add");
    add.mockImplementationOnce(add.getMockImplementation()!).mockRejectedValueOnce(new Error("subject write failed"));

    await expect(profileRepository.initialize({ subjects: [{ name: "Piano", type: "instrument" }, { name: "Theory", type: "theory" }], name: "Alice", lang: "en", reminderTime: "09:00", reminderFreq: "daily", reminderDays: [], lateRecoveryDays: 1, graceDay: false, groupByPhase: false, onboarded: true })).rejects.toThrow("subject write failed");

    expect(await db.subjects.count()).toBe(0);
    expect(await db.profile.get("me")).toBeUndefined();
  });

  it("creates a study routine and generates its planned tasks", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: Date.now() });
    const itemId = await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: Date.now() });

    const id = await studyRoutineRepository.create({
      subjectId,
      groups: [{ id: "pieces", name: "Pieces", pool: [{ type: "item", id: itemId }] }],
      matrix: { "1": { pieces: 1 } },
      weeksAhead: 1,
      repetitionCap: 1,
      useSpacedRepetition: false,
      startDate: "2026-05-18",
    });

    expect(await db.studyRoutines.get(id)).toMatchObject({ id, subjectId });
    expect(await db.tasks.where("studyRoutineId").equals(id).count()).toBe(1);
  });
});
