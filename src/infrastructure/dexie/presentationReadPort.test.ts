import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "./db";
import { dexiePresentationReads } from "./presentationReadPort";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("dexie presentation reads", () => {
  it("offers studies and pieces to programs and filters repertoire by both eligibility and flag", async () => {
    await db.library.bulkAdd([
      { subjectId: 1, kind: "piece", studyStatus: "not_started", title: "Piece", createdAt: 1 },
      { subjectId: 1, kind: "study", studyStatus: "not_started", title: "Study", inRepertoire: true, createdAt: 1 },
      { subjectId: 1, kind: "exercise", studyStatus: "not_started", title: "Exercise", inRepertoire: true, createdAt: 1 },
      { subjectId: 1, kind: "study", studyStatus: "not_started", title: "Archived", deletedAt: 2, createdAt: 1 },
    ]);
    expect((await dexiePresentationReads.read<{ title: string }[]>("library.performable")).map(i => i.title)).toEqual(["Piece", "Study"]);
    expect((await dexiePresentationReads.read<{ title: string }[]>("repertoire.active")).map(i => i.title)).toEqual(["Study"]);
  });
  it("returns collection links for one library item", async () => {
    await db.collectionItems.bulkAdd([
      { collectionId: 1, itemId: 7, createdAt: 1 },
      { collectionId: 2, itemId: 7, createdAt: 1 },
      { collectionId: 1, itemId: 8, createdAt: 1 },
    ]);

    const result = await dexiePresentationReads.read<{ collectionId: number; itemId: number }[]>("collectionLinks.item", [7]);

    expect(result.map(({ collectionId, itemId }) => ({ collectionId, itemId }))).toEqual([
      { collectionId: 1, itemId: 7 },
      { collectionId: 2, itemId: 7 },
    ]);
  });

  it("returns active diary tasks and their sessions for a date", async () => {
    const taskId = await db.tasks.add({ subjectId: 1, title: "Scales", date: "2026-07-20", plan: [], done: false, createdAt: 1 });
    await db.tasks.add({ subjectId: 1, title: "Deleted", date: "2026-07-20", plan: [], done: false, createdAt: 1, deletedAt: 2 });
    await db.sessions.add({ taskId, date: "2026-07-20", marks: [], createdAt: 1 });

    const result = await dexiePresentationReads.read<{ tasks: { id?: number }[]; sessionsByTask: Record<number, { taskId: number }[]> }>("tasks.diaryDate", ["2026-07-20"]);

    expect(result.tasks.map((task) => task.id)).toEqual([taskId]);
    expect(result.sessionsByTask[taskId]).toHaveLength(1);
  });

  it("returns lesson-scoped assignment reads without exposing tables", async () => {
    const lessonId = await db.lessons.add({ subjectId: 1, date: "2026-07-20", createdAt: 1 });
    await db.assignments.bulkAdd([
      { lessonId, text: "Keep wrist loose", taskIds: [], createdAt: 1 },
      { lessonId: lessonId + 1, text: "Ignore", taskIds: [], createdAt: 1 },
    ]);
    await db.helpRequests.bulkAdd([
      { id: 1, question: "Open", resolved: false, createdAt: 1 },
      { id: 2, question: "Closed", resolved: true, createdAt: 1 },
    ]);

    const [assignments, openCount] = await Promise.all([
      dexiePresentationReads.read<{ text: string }[]>("assignments.lesson", [lessonId]),
      dexiePresentationReads.read<number>("helpRequests.openCount"),
    ]);

    expect(assignments.map((assignment) => assignment.text)).toEqual(["Keep wrist loose"]);
    expect(openCount).toBe(1);
  });

  it("returns null for profile.current when profile is not present, and the profile when it is present", async () => {
    const initialResult = await dexiePresentationReads.read<unknown>("profile.current");
    expect(initialResult).toBeNull();

    await db.profile.put({ id: "me", name: "Ada", onboarded: true, introSeen: true, lang: "en", createdAt: 1, reminderTime: "18:00", reminderFreq: "daily", reminderDays: [], lateRecoveryDays: 2, graceDay: false, groupByPhase: false });
    const updatedResult = await dexiePresentationReads.read<{ name: string }>("profile.current");
    expect(updatedResult).not.toBeNull();
    expect(updatedResult.name).toBe("Ada");
  });
});
