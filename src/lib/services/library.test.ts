import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { libraryService } from "@/lib/services/library";

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
      { subjectId, kind: "repertoire", title: "Sonata", createdAt: 1 },
      { subjectId, kind: "technique", title: "Scales", createdAt: 2 },
    ]);
    const items = await libraryService.list();
    expect(items).toHaveLength(2);
  });

  it("excludes soft-deleted items", async () => {
    const subjectId = await seedSubject();
    await db.library.add({ subjectId, kind: "repertoire", title: "Archived", createdAt: 1, deletedAt: Date.now() });
    await db.library.add({ subjectId, kind: "repertoire", title: "Active", createdAt: 2 });
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
    const id = (await db.library.add({ subjectId, kind: "repertoire", title: "Concerto", createdAt: 1 })) as number;
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
    const id = await libraryService.upsert({ subjectId, kind: "repertoire", title: "Étude", createdAt: 0 });
    expect(typeof id).toBe("number");
    const item = await db.library.get(id);
    expect(item).toBeDefined();
    expect(item!.title).toBe("Étude");
  });

  it("creates associated segments", async () => {
    const subjectId = await seedSubject();
    const id = await libraryService.upsert(
      { subjectId, kind: "repertoire", title: "Sonata", createdAt: 0 },
      [
        { label: "Movement I", layers: [] },
        { label: "Movement II", layers: [] },
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
    const id = (await db.library.add({ subjectId, kind: "repertoire", title: "Old title", createdAt: 1 })) as number;
    await libraryService.upsert({ id, subjectId, kind: "repertoire", title: "New title", createdAt: 1 });
    const item = await db.library.get(id);
    expect(item!.title).toBe("New title");
  });

  it("replaces existing segments when updating", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "repertoire", title: "Suite", createdAt: 1 })) as number;
    await db.segments.bulkAdd([
      { itemId: id, label: "Old I", layers: [], createdAt: 1 },
      { itemId: id, label: "Old II", layers: [], createdAt: 2 },
    ]);

    await libraryService.upsert(
      { id, subjectId, kind: "repertoire", title: "Suite", createdAt: 1 },
      [{ label: "New I", layers: [] }],
    );

    const segs = await db.segments.where("itemId").equals(id).toArray();
    expect(segs).toHaveLength(1);
    expect(segs[0].label).toBe("New I");
  });

  it("clears all segments when updating with empty array", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "repertoire", title: "Work", createdAt: 1 })) as number;
    await db.segments.add({ itemId: id, label: "Seg", layers: [], createdAt: 1 });

    await libraryService.upsert({ id, subjectId, kind: "repertoire", title: "Work", createdAt: 1 }, []);

    expect(await db.segments.where("itemId").equals(id).count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("libraryService.remove", () => {
  it("hard-deletes an item that has no practice sessions", async () => {
    const subjectId = await seedSubject();
    const id = (await db.library.add({ subjectId, kind: "repertoire", title: "Unused", createdAt: 1 })) as number;
    const result = await libraryService.remove(id);
    expect(result).toBe("hard");
    expect(await db.library.get(id)).toBeUndefined();
  });

  it("soft-deletes an item that has at least one session in history", async () => {
    const subjectId = await seedSubject();
    const itemId = (await db.library.add({ subjectId, kind: "repertoire", title: "Practiced", createdAt: 1 })) as number;
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
      { subjectId, kind: "repertoire", title: "With segments", createdAt: 0 },
      [{ label: "Movement I", layers: [] }],
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
      { subjectId, kind: "repertoire", title: "Symphony", createdAt: 0 },
      [{ label: "Allegro", layers: [] }, { label: "Andante", layers: [] }],
    );

    expect((await db.library.get(id))!.title).toBe("Symphony");
    expect(await db.segments.where("itemId").equals(id).count()).toBe(2);

    await libraryService.upsert(
      { id, subjectId, kind: "repertoire", title: "Symphony No. 5", createdAt: 0 },
      [{ label: "Allegro con brio", layers: [] }],
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
    const id1 = await libraryService.upsert({ subjectId, kind: "repertoire", title: "Piece A", createdAt: 0 });
    const id2 = await libraryService.upsert({ subjectId, kind: "repertoire", title: "Piece B", createdAt: 0 });

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
