import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  db,
  exportAll,
  importAll,
  wipeAll,
  buildSessionSnapshot,
  buildLessonSnapshot,
  deleteTaskPreservingHistory,
  deleteTasksPreservingHistory,
  deleteLibraryItem,
} from "./db";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ---------------------------------------------------------------------------
// exportAll / importAll round-trip
// ---------------------------------------------------------------------------

describe("exportAll / importAll", () => {
  it("round-trips every table", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 2 });

    const json = await exportAll();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.data.subjects).toHaveLength(1);
    expect(parsed.data.library).toHaveLength(1);

    await wipeAll();
    expect(await db.subjects.count()).toBe(0);

    await importAll(json);
    const subjects = await db.subjects.toArray();
    const items = await db.library.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("Piano");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Sonata");
  });

  it("rejects payloads with the wrong shape", async () => {
    await expect(importAll("not json")).rejects.toThrow();
    await expect(importAll(JSON.stringify({ data: { subjects: "no" } }))).rejects.toThrow();
  });

  it("replaces existing data entirely on import", async () => {
    await db.subjects.add({ name: "Old", type: "instrument", createdAt: 1 });
    const json = JSON.stringify({
      version: 1,
      data: { subjects: [{ name: "New", type: "theory", createdAt: 9 }] },
    });
    await importAll(json);
    const subjects = await db.subjects.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("New");
  });
});

// ---------------------------------------------------------------------------
// buildSessionSnapshot
// ---------------------------------------------------------------------------

describe("buildSessionSnapshot", () => {
  it("denormalizes subject, item, segments, techniques into an immutable copy", async () => {
    const subjectId = (await db.subjects.add({ name: "Violin", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({
      subjectId, kind: "repertoire", title: "Caprice 24", composer: "Paganini", createdAt: 2,
    })) as number;
    const seg1 = (await db.segments.add({ itemId, label: "Theme", layers: [], createdAt: 3 })) as number;
    const seg2 = (await db.segments.add({ itemId, label: "Var I", layers: [], createdAt: 4 })) as number;
    const tech = (await db.techniques.add({ subjectId, name: "Spiccato", createdAt: 5 })) as number;

    const snap = await buildSessionSnapshot({
      title: "Caprice", date: "2025-01-01", subjectId, itemId,
      segmentIds: [seg1, seg2], techniqueIds: [tech], targetBpm: 120, noteVal: "eighth",
      layers: ["slow"], done: false, createdAt: 0,
    });

    expect(snap.subjectName).toBe("Violin");
    expect(snap.itemTitle).toBe("Caprice 24");
    expect(snap.itemComposer).toBe("Paganini");
    expect(snap.segments?.map((s) => s.label).sort()).toEqual(["Theme", "Var I"]);
    expect(snap.techniqueNames).toEqual(["Spiccato"]);
    expect(snap.targetBpm).toBe(120);
    expect(snap.layers).toEqual(["slow"]);
  });

  it("falls back to em-dash when subject is missing", async () => {
    const snap = await buildSessionSnapshot({
      title: "Mystery", date: "2025-01-01", subjectId: 9999,
      done: false, createdAt: 0,
    });
    expect(snap.subjectName).toBe("—");
    expect(snap.itemTitle).toBeUndefined();
    expect(snap.segments).toBeUndefined();
  });

  it("includes collection name when task is collection-linked", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const collectionId = (await db.collections.add({
      kind: "repertoire", name: "Études Op. 10", createdAt: 1, updatedAt: 1,
    })) as number;
    const snap = await buildSessionSnapshot({
      title: "Op. 10 No. 1", date: "2025-01-01", subjectId, collectionId,
      done: false, createdAt: 0,
    });
    expect(snap.collectionName).toBe("Études Op. 10");
  });
});

// ---------------------------------------------------------------------------
// buildLessonSnapshot
// ---------------------------------------------------------------------------

describe("buildLessonSnapshot", () => {
  it("captures subject + teacher + frequency + piece titles", async () => {
    const subjectId = (await db.subjects.add({ name: "Cello", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({
      subjectId, kind: "repertoire", title: "Bach Suite 1", createdAt: 2,
    })) as number;

    const { snapshot, piecesPlayedTitles } = await buildLessonSnapshot(
      subjectId,
      { id: 1, subjectId, teacher: "Maestro", frequency: "weekly", dayOfWeek: 3,
        startTime: "10:00", endTime: "11:00", startDate: "2025-01-01",
        color: "terracotta", createdAt: 1 },
      [itemId],
    );

    expect(snapshot.subjectName).toBe("Cello");
    expect(snapshot.teacher).toBe("Maestro");
    expect(snapshot.frequency).toBe("weekly");
    expect(piecesPlayedTitles).toEqual(["Bach Suite 1"]);
  });
});

// ---------------------------------------------------------------------------
// deleteTaskPreservingHistory
// ---------------------------------------------------------------------------

describe("deleteTaskPreservingHistory", () => {
  it("hard-deletes a fresh task", async () => {
    const id = (await db.tasks.add({
      subjectId: 1, title: "Scales", date: "2025-01-01", done: false, createdAt: 1,
    })) as number;
    expect(await deleteTaskPreservingHistory(id)).toBe("hard");
    expect(await db.tasks.get(id)).toBeUndefined();
  });

  it("soft-deletes a task with a session", async () => {
    const id = (await db.tasks.add({
      subjectId: 1, title: "Scales", date: "2025-01-01", done: true, createdAt: 1,
    })) as number;
    await db.sessions.add({ taskId: id, date: "2025-01-01", quality: "well", createdAt: 1 });
    expect(await deleteTaskPreservingHistory(id)).toBe("soft");
    const task = await db.tasks.get(id);
    expect(task?.deletedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// deleteTasksPreservingHistory — empty input
// ---------------------------------------------------------------------------

describe("deleteTasksPreservingHistory", () => {
  it("returns zeros for an empty input array", async () => {
    expect(await deleteTasksPreservingHistory([])).toEqual({ soft: 0, hard: 0 });
  });
});

// ---------------------------------------------------------------------------
// deleteLibraryItem — cleanup of segments and tasks
// ---------------------------------------------------------------------------

describe("deleteLibraryItem", () => {
  it("hard-deletes item + segments + tasks when no sessions exist", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ subjectId, kind: "repertoire", title: "Piece", createdAt: 1 })) as number;
    await db.segments.add({ itemId, label: "I", layers: [], createdAt: 1 });
    await db.tasks.add({ subjectId, itemId, title: "Practice", date: "2025-01-01", done: false, createdAt: 1 });

    expect(await deleteLibraryItem(itemId)).toBe("hard");
    expect(await db.library.get(itemId)).toBeUndefined();
    expect(await db.segments.where("itemId").equals(itemId).count()).toBe(0);
    expect(await db.tasks.where("itemId").equals(itemId).count()).toBe(0);
  });

  it("soft-deletes the item but preserves segments/tasks when a session exists", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ subjectId, kind: "repertoire", title: "Piece", createdAt: 1 })) as number;
    const segId = (await db.segments.add({ itemId, label: "I", layers: [], createdAt: 1 })) as number;
    const taskId = (await db.tasks.add({ subjectId, itemId, title: "T", date: "2025-01-01", done: true, createdAt: 1 })) as number;
    await db.sessions.add({ taskId, date: "2025-01-01", quality: "well", createdAt: 1 });

    expect(await deleteLibraryItem(itemId)).toBe("soft");
    expect((await db.library.get(itemId))?.deletedAt).toBeDefined();
    // Tasks and segments should still exist so the session can be rendered with full context
    expect(await db.tasks.get(taskId)).toBeDefined();
    expect(await db.segments.get(segId)).toBeDefined();
  });
});
