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

it("upgrades session references and removes only obsolete study status", async () => {
  const legacy = new Dexie("virtuoso");
  legacy.version(13).stores(V13);
  await legacy.open();
  await legacy.table("subjects").bulkAdd([
    { id: 7, name: "Piano", type: "instrument", layers: ["RH"], createdAt: 1 },
    { id: 8, name: "Harmony", type: "theory", layers: [], createdAt: 1 },
    { id: 9, name: "History", type: "theory", createdAt: 1 },
    { id: 10, name: "Analysis", type: "theory", layers: ["Compare scores"], createdAt: 1 },
  ]);
  await legacy.table("tasks").add({ id: 1, date: "2026-10-01", subjectId: 7, linkType: "item", itemId: 3, title: "Ballade", plan: [], done: true, createdAt: 1 });
  await legacy.table("sessions").bulkAdd([
    { id: 1, taskId: 1, date: "2026-10-01", notes: "kept", marks: [{ layers: [], techniques: [], confidence: 4 }], createdAt: 1 },
    { id: 2, taskId: 99, date: "2026-10-02", marks: [], snapshot: { taskTitle: "Gone", subjectName: "Piano" }, createdAt: 2 },
  ]);
  await legacy.table("library").add({ id: 3, subjectId: 7, kind: "piece", title: "Ballade", studyStatus: "consolidated", isFavorite: true, inRepertoire: true, createdAt: 1 });
  legacy.close();

  const { db } = await import("./db");
  await db.open();

  expect((await db.subjects.get(7))?.layers).toEqual(["RH"]);
  expect((await db.subjects.get(8))?.layers).toEqual(["conceptual", "analytical", "aural", "compositional", "reading"]);
  expect((await db.subjects.get(9))?.layers).toEqual(["conceptual", "analytical", "aural", "compositional", "reading"]);
  expect((await db.subjects.get(10))?.layers).toEqual(["Compare scores"]);

  expect(await db.sessions.get(1)).toMatchObject({ taskId: 1, subjectId: 7, linkType: "item", itemId: 3, notes: "kept", marks: [{ confidence: 4 }] });
  expect((await db.sessions.get(1))?.marks[0].mood).toBeUndefined();
  expect(await db.sessions.get(2)).toMatchObject({ taskId: 99, snapshot: { taskTitle: "Gone" } });
  expect((await db.sessions.get(2))?.subjectId).toBeUndefined();
  expect(await db.library.get(3)).toEqual({ id: 3, subjectId: 7, kind: "piece", title: "Ballade", isFavorite: true, inRepertoire: true, createdAt: 1 });
  expect(await db.tasks.count()).toBe(1);
  expect(await db.sessions.where("itemId").equals(3).count()).toBe(1);
});

it("upgrades v17 additively without initializing rules or rewriting historical marks", async () => {
  const {db}=await import("./db");await db.delete();
  const legacy=new Dexie("virtuoso");legacy.version(17).stores({...V13,sessions:"++id, taskId, date, subjectId, itemId",recordings:"++id, &uid, sessionId"});
  await legacy.open();
  const session={id:1,itemId:3,date:"2026-10-22",createdAt:1,marks:[{segmentId:7,bpm:10,noteVal:"dotted-quarter",layers:[],techniques:[],confidence:4}]};
  await legacy.table("sessions").add(session);legacy.close();await db.open();
  expect(await db.tempoProgressions.count()).toBe(0);
  expect((await db.sessions.get(1))?.marks).toEqual(session.marks);
  expect((await db.sessions.get(1))?.tempoProgressionIds).toBeUndefined();
  expect((await db.sessions.get(1))?.tempoSegmentIds).toEqual([7]);
});
