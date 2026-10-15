import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";

// Cumulative v13 schema, copied from db.ts, so the upgrade runs against a real older database.
const V13 = {
  profile: "id", subjects: "++id, name, type, deletedAt", techniques: "++id, subjectId, name, deletedAt",
  library: "++id, subjectId, kind, title, deletedAt, inRepertoire, nextReviewAt", segments: "++id, itemId, deletedAt",
  tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt, studyRoutineId, recurrenceTaskId",
  sessions: "++id, taskId, date", helpRequests: "++id, sessionId, itemId, resolved", recurrences: "++id, subjectId, deletedAt",
  lessons: "++id, recurrenceId, subjectId, date", assignments: "++id, lessonId, *taskIds",
  collections: "++id, name, kind, composer, defaultSubjectId, deletedAt", collectionItems: "++id, collectionId, itemId, [collectionId+itemId]",
  studyRoutines: "++id, subjectId, deletedAt", performances: "++id, date, subjectId, deletedAt", performanceItems: "++id, eventId, itemId, [eventId+itemId]",
};

it("v14 back-fills session references from their task, keeps orphans and wipes nothing", async () => {
  const legacy = new Dexie("virtuoso");
  legacy.version(13).stores(V13);
  await legacy.open();
  await legacy.table("tasks").add({ id: 1, date: "2026-10-01", subjectId: 7, linkType: "item", itemId: 3, title: "Ballade", plan: [], done: true, createdAt: 1 });
  await legacy.table("sessions").bulkAdd([
    { id: 1, taskId: 1, date: "2026-10-01", notes: "kept", marks: [{ layers: [], techniques: [], confidence: 4 }], createdAt: 1 },
    { id: 2, taskId: 99, date: "2026-10-02", marks: [], snapshot: { taskTitle: "Gone", subjectName: "Piano" }, createdAt: 2 },
  ]);
  legacy.close();

  const { db } = await import("./db");
  await db.open();

  expect(await db.sessions.get(1)).toMatchObject({ taskId: 1, subjectId: 7, linkType: "item", itemId: 3, notes: "kept", marks: [{ confidence: 4 }] });
  expect((await db.sessions.get(1))?.marks[0].mood).toBeUndefined();
  expect(await db.sessions.get(2)).toMatchObject({ taskId: 99, snapshot: { taskTitle: "Gone" } });
  expect((await db.sessions.get(2))?.subjectId).toBeUndefined();
  expect(await db.tasks.count()).toBe(1);
  expect(await db.sessions.where("itemId").equals(3).count()).toBe(1);
});
