import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "./db";
import { dexiePresentationReads } from "./presentationReadPort";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("dexie presentation reads", () => {
  it("returns collection links for one library item", async () => {
    await db.collectionItems.bulkAdd([
      { collectionId: 1, itemId: 7 },
      { collectionId: 2, itemId: 7 },
      { collectionId: 1, itemId: 8 },
    ]);

    const result = await dexiePresentationReads.read<{ collectionId: number; itemId: number }[]>("collectionLinks.item", [7]);

    expect(result.map(({ collectionId, itemId }) => ({ collectionId, itemId }))).toEqual([
      { collectionId: 1, itemId: 7 },
      { collectionId: 2, itemId: 7 },
    ]);
  });

  it("returns active diary tasks and their sessions for a date", async () => {
    const taskId = await db.tasks.add({ subjectId: 1, title: "Scales", date: "2026-07-20", done: false, createdAt: 1 });
    await db.tasks.add({ subjectId: 1, title: "Deleted", date: "2026-07-20", done: false, createdAt: 1, deletedAt: 2 });
    await db.sessions.add({ taskId, date: "2026-07-20", duration: 20, quality: "well", createdAt: 1 });

    const result = await dexiePresentationReads.read<{ tasks: { id?: number }[]; sessionsByTask: Record<number, { taskId: number }[]> }>("tasks.diaryDate", ["2026-07-20"]);

    expect(result.tasks.map((task) => task.id)).toEqual([taskId]);
    expect(result.sessionsByTask[taskId]).toHaveLength(1);
  });
});
