import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/infrastructure/dexie/db";
import { libraryService } from "@/lib/services";
import { collectionsService } from "@/lib/services/collections";
import { backupService } from "@/lib/services/backup";
import { performanceRepository } from "@/infrastructure/repositories/dexie/performanceRepository";

describe("stable material identities", () => {
  it("validates retained section skills when a caller omits the section payload", async () => {
    const subjectId = await seedSubject();
    const other = await db.subjects.add({ name: "Other", type: "instrument", createdAt: 1 });
    const techniqueId = await db.techniques.add({ subjectId, name: "Legato", createdAt: 1 });
    const itemId = await libraryService.upsert({ subjectId, kind: "exercise", title: "Exercise", createdAt: 1 }, [{ label: "A", position: 0, layers: [], techniqueIds: [techniqueId] }]);
    await expect(libraryService.upsert({ ...(await db.library.get(itemId))!, subjectId: other })).rejects.toThrow();
    expect((await db.library.get(itemId))?.subjectId).toBe(subjectId);
  });
  it("round trips archived performable materials without losing their existing programs", async () => {
    const subjectId = await seedSubject();
    const itemId = await libraryService.upsert({ subjectId, kind: "study", title: "Study", createdAt: 1 });
    const eventId = await performanceRepository.upsertEvent({ name: "Recital", kind: "concert", date: "2026-10-17", createdAt: 1 });
    await performanceRepository.setEventItems(eventId, [itemId]);
    await db.sessions.add({ subjectId, itemId, linkType: "item", date: "2026-10-17", marks: [{ layers: [], techniques: [], confidence: 4 }], createdAt: 1 });
    await libraryService.remove(itemId);
    const links = await db.performanceItems.toArray();
    await backupService.importAll(await backupService.exportAll());
    expect(await db.performanceItems.toArray()).toEqual(links);
    expect((await db.library.get(itemId))?.deletedAt).toBeTypeOf("number");
  });

  it("keeps snapshot-only segments after edited free-session results stop referring to them", async () => {
    const subjectId = await seedSubject();
    const item = { subjectId, kind: "study" as const, title: "Study", createdAt: 1 };
    const id = await libraryService.upsert(item, [{ label: "A", position: 0, layers: [] }]);
    const [segment] = await db.segments.toArray();
    const sessionId = await db.sessions.add({ subjectId, itemId: id, linkType: "item", date: "2026-10-17", marks: [{ layers: [], techniques: [], confidence: 4 }], snapshot: { taskTitle: "Study", subjectName: "Piano", segments: [{ id: String(segment.id), label: "A" }] }, createdAt: 1 });
    await libraryService.upsert({ ...item, id }, []);
    expect((await db.segments.get(segment.id))?.deletedAt).toBeTypeOf("number");
    await backupService.importAll(await backupService.exportAll());
    expect((await db.sessions.get(sessionId))?.snapshot?.segments?.[0].label).toBe("A");
  });

  it("round trips unchanged historical subject references after a material changes subject", async () => {
    const subjectId = await seedSubject();
    const other = await db.subjects.add({ name: "Solfeggio", type: "theory", createdAt: 1 });
    const itemId = await libraryService.upsert({ subjectId, kind: "exercise", title: "Reading", createdAt: 1 });
    const taskId = await db.tasks.add({ subjectId, itemId, title: "Reading", date: "2026-10-17", plan: [], done: true, createdAt: 1 });
    const sessionId = await db.sessions.add({ taskId, subjectId, itemId, linkType: "item", date: "2026-10-17", marks: [{ layers: [], techniques: [], confidence: 4 }], createdAt: 1 });
    await libraryService.upsert({ ...(await db.library.get(itemId))!, subjectId: other });
    await backupService.importAll(await backupService.exportAll());
    expect((await db.tasks.get(taskId))?.subjectId).toBe(subjectId);
    expect((await db.sessions.get(sessionId))?.subjectId).toBe(subjectId);
  });
  it("preserves omitted segments, stable IDs, dates, saved plans and session/recording references", async () => {
    const subjectId = await seedSubject();
    const item = { subjectId, kind: "study" as const, title: "Study", createdAt: 1 };
    const id = await libraryService.upsert(item, [{ label: "A", position: 0, layers: [], barStart: 1, barEnd: 8 }]);
    const [segment] = await db.segments.where("itemId").equals(id).toArray();
    const taskId = await db.tasks.add({ subjectId, itemId: id, title: "Study", date: "2026-10-17", plan: [{ segmentId: segment.id, layers: [], techniques: [] }], done: true, createdAt: 1 });
    const sessionId = await db.sessions.add({ taskId, itemId: id, date: "2026-10-17", marks: [{ segmentId: segment.id, layers: [], techniques: [] }], createdAt: 1 });
    await db.recordings.add({ uid: "clip", sessionId, segmentId: segment.id, date: "2026-10-17", mimeType: "audio/webm", durationMs: 10, createdAt: 1 });
    const savedSession = await db.sessions.get(sessionId);
    const savedTask = await db.tasks.get(taskId);
    await libraryService.upsert({ ...item, id, title: "Renamed" });
    expect(await db.segments.get(segment.id)).toEqual(segment);
    await libraryService.upsert({ ...item, id }, [{ ...segment, label: "Renamed A", position: 1 }, { label: "Overlap", position: 0, layers: [], barStart: 4, barEnd: 10 }]);
    expect(await db.segments.get(segment.id)).toMatchObject({ id: segment.id, label: "Renamed A", createdAt: segment.createdAt });
    await libraryService.upsert({ ...item, id }, []);
    expect((await db.segments.get(segment.id))?.deletedAt).toBeTypeOf("number");
    expect(await db.sessions.get(sessionId)).toEqual(savedSession);
    expect(await db.tasks.get(taskId)).toEqual(savedTask);
    expect((await db.recordings.toArray())[0].segmentId).toBe(segment.id);
  });

  it("rejects foreign and duplicate segment IDs without partial updates", async () => {
    const subjectId = await seedSubject();
    const item = { subjectId, kind: "study" as const, title: "Original", createdAt: 1 };
    const a = await libraryService.upsert(item, [{ label: "A", position: 0, layers: [] }]);
    const b = await libraryService.upsert(item);
    const [segment] = await db.segments.toArray();
    await expect(libraryService.upsert({ ...item, id: b, title: "Changed" }, [segment])).rejects.toThrow();
    await expect(libraryService.upsert({ ...item, id: a }, [segment, segment])).rejects.toThrow();
    expect((await db.library.get(b))?.title).toBe("Original");
    expect(await db.segments.get(segment.id)).toEqual(segment);
  });

  it("creates and links atomically and preserves metadata on unchanged memberships", async () => {
    const subjectId = await seedSubject();
    const item = { subjectId, kind: "exercise" as const, title: "Exercise", createdAt: 1 };
    await expect(libraryService.upsert(item, [{ label: "A", position: 0, layers: [] }], [999])).rejects.toThrow();
    expect(await db.library.count()).toBe(0);
    expect(await db.segments.count()).toBe(0);
    expect(await db.collectionItems.count()).toBe(0);
    const collectionId = await collectionsService.create({ kind: "manual", name: "Method" });
    const id = await libraryService.upsert(item, [], [collectionId]);
    await collectionsService.updateItemLink(collectionId, id, { reference: "Ex. 37", pageStart: 8, pageEnd: 9 });
    const links = await collectionsService.items(collectionId);
    await libraryService.upsert({ ...item, id }, undefined, [collectionId, collectionId]);
    expect(await collectionsService.items(collectionId)).toEqual(links);
    await libraryService.upsert({ ...item, id });
    expect(await collectionsService.items(collectionId)).toEqual(links);
  });
});

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
// list
// ---------------------------------------------------------------------------

describe("libraryService.list", () => {
  it("returns all non-deleted items", async () => {
    const subjectId = await seedSubject();
    await db.library.bulkAdd([
      { subjectId, kind: "piece", title: "Sonata", createdAt: 1 },
      { subjectId, kind: "technique", title: "Scales", createdAt: 2 },
    ]);
    const items = await libraryService.list();
    expect(items).toHaveLength(2);
  });

  it("excludes soft-deleted items", async () => {
    const subjectId = await seedSubject();
    await db.library.add({ subjectId, kind: "piece", title: "Archived", createdAt: 1, deletedAt: Date.now() });
    await db.library.add({ subjectId, kind: "piece", title: "Active", createdAt: 2 });
    const items = await libraryService.list();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Active");
  });

  it("returns empty array when no items exist", async () => {
    expect(await libraryService.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe("libraryService.get", () => {
  it("returns the item by id", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "piece", title: "Concerto", createdAt: 1 })) as number;
    const item = await libraryService.get(id);
    expect(item).toBeDefined();
    expect(item!.title).toBe("Concerto");
  });

  it("returns undefined for a missing id", async () => {
    expect(await libraryService.get(9999)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// upsert — create (no id)
// ---------------------------------------------------------------------------

describe("libraryService.upsert — create", () => {
  it("adds the item and returns its id", async () => {
    const subjectId = await seedSubject();
    const id = await libraryService.upsert({ subjectId, kind: "piece", title: "Étude", createdAt: 0 });
    expect(typeof id).toBe("number");
    const item = await db.library.get(id);
    expect(item).toBeDefined();
    expect(item!.title).toBe("Étude");
  });

  it("creates associated segments", async () => {
    const subjectId = await seedSubject();
    const id = await libraryService.upsert(
      { subjectId, kind: "piece", title: "Sonata", createdAt: 0 },
      [
        { position: 0, label: "Movement I", layers: [] },
        { position: 0, label: "Movement II", layers: [] },
      ],
    );
    const segs = await db.segments.where("itemId").equals(id).toArray();
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.label).sort()).toEqual(["Movement I", "Movement II"]);
  });

  it("creates item with no segments when none provided", async () => {
    const subjectId = await seedSubject();
    const id = await libraryService.upsert({ subjectId, kind: "technique", title: "Arpeggios", createdAt: 0 });
    expect(await db.segments.where("itemId").equals(id).count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// upsert — update (with id)
// ---------------------------------------------------------------------------

describe("libraryService.upsert — update", () => {
  it("updates an existing item in-place", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "piece", title: "Old title", createdAt: 1 })) as number;
    await libraryService.upsert({ id, subjectId, kind: "piece", title: "New title", createdAt: 1 });
    const item = await db.library.get(id);
    expect(item!.title).toBe("New title");
  });

  it("replaces existing segments when updating", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "piece", title: "Suite", createdAt: 1 })) as number;
    await db.segments.bulkAdd([
      { itemId: id, position: 0, label: "Old I", layers: [], createdAt: 1 },
      { itemId: id, position: 0, label: "Old II", layers: [], createdAt: 2 },
    ]);

    await libraryService.upsert(
      { id, subjectId, kind: "piece", title: "Suite", createdAt: 1 },
      [{ position: 0, label: "New I", layers: [] }],
    );

    const segs = await db.segments.where("itemId").equals(id).toArray();
    expect(segs).toHaveLength(1);
    expect(segs[0].label).toBe("New I");
  });

  it("clears all segments when updating with empty array", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "piece", title: "Work", createdAt: 1 })) as number;
    await db.segments.add({ itemId: id, position: 0, label: "Seg", layers: [], createdAt: 1 });

    await libraryService.upsert({ id, subjectId, kind: "piece", title: "Work", createdAt: 1 }, []);

    expect(await db.segments.where("itemId").equals(id).count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("libraryService.remove", () => {
  it("hard-deletes an item that has no practice sessions", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "piece", title: "Unused", createdAt: 1 })) as number;
    const result = await libraryService.remove(id);
    expect(result).toBe("hard");
    expect(await db.library.get(id)).toBeUndefined();
  });

  it("soft-deletes an item that has at least one session in history", async () => {
    const subjectId = await seedSubject();
    const itemId = (await db.library.add({ subjectId, kind: "piece", title: "Practiced", createdAt: 1 })) as number;
    const taskId = (await db.tasks.add({
      subjectId,
      itemId,
      date: "2025-01-01",
      title: "Practice",
      plan: [],
      done: true,
      createdAt: 1,
    })) as number;
    await db.sessions.add({ taskId, date: "2025-01-01", marks: [], createdAt: 1 });

    const result = await libraryService.remove(itemId);
    expect(result).toBe("soft");
    const item = await db.library.get(itemId);
    expect(item).toBeDefined();
    expect(item!.deletedAt).toBeDefined();
  });

  it("also removes associated segments when hard-deleting", async () => {
    const subjectId = await seedSubject();
    const id = await libraryService.upsert(
      { subjectId, kind: "piece", title: "With segments", createdAt: 0 },
      [{ position: 0, label: "Movement I", layers: [] }],
    );
    await libraryService.remove(id);
    expect(await db.library.get(id)).toBeUndefined();
    expect(await db.segments.where("itemId").equals(id).count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// integration: upsert + remove round-trip
// ---------------------------------------------------------------------------

describe("libraryService — round-trip integration", () => {
  it("creates an item with segments, updates it, then removes it cleanly", async () => {
    const subjectId = await seedSubject();

    const id = await libraryService.upsert(
      { subjectId, kind: "piece", title: "Symphony", createdAt: 0 },
      [{ position: 0, label: "Allegro", layers: [] }, { position: 0, label: "Andante", layers: [] }],
    );

    expect((await db.library.get(id))!.title).toBe("Symphony");
    expect(await db.segments.where("itemId").equals(id).count()).toBe(2);

    await libraryService.upsert(
      { id, subjectId, kind: "piece", title: "Symphony No. 5", createdAt: 0 },
      [{ position: 0, label: "Allegro con brio", layers: [] }],
    );
    expect((await db.library.get(id))!.title).toBe("Symphony No. 5");
    expect(await db.segments.where("itemId").equals(id).count()).toBe(1);

    const result = await libraryService.remove(id);
    expect(result).toBe("hard");
    expect(await db.library.get(id)).toBeUndefined();
    expect(await db.segments.where("itemId").equals(id).count()).toBe(0);
  });

  it("list correctly reflects creates and soft-deletes", async () => {
    const subjectId = await seedSubject();
    const id1 = await libraryService.upsert({ subjectId, kind: "piece", title: "Piece A", createdAt: 0 });
    const id2 = await libraryService.upsert({ subjectId, kind: "piece", title: "Piece B", createdAt: 0 });

    expect((await libraryService.list()).map((i) => i.title).sort()).toEqual(["Piece A", "Piece B"]);

    // Attach a session so remove produces a soft-delete
    const taskId = (await db.tasks.add({ subjectId, itemId: id1, date: "2025-01-01", title: "T", plan: [], done: true, createdAt: 1 })) as number;
    await db.sessions.add({ taskId, date: "2025-01-01", marks: [], createdAt: 1 });
    await libraryService.remove(id1);

    const remaining = await libraryService.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
