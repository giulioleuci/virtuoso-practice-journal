import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { collectionsService } from "@/lib/services/collections";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedItem(title: string, kind: "piece" | "theory" = "piece") {
  return (await db.library.add({
    subjectId: 1, kind, studyStatus: "not_started", title, createdAt: Date.now(),
  })) as number;
}

describe("collectionsService", () => {
  it("keeps a mixed index ordered, deduplicated and undoable with its source metadata", async () => {
    const id = await collectionsService.create({ kind: "manual", name: "Mixed" });
    const a = await seedItem("Theory", "theory");
    const b = await seedItem("Piece");
    await collectionsService.addItems(id, [a, a, b]);
    expect(await collectionsService.countItems(id)).toBe(2);
    await collectionsService.updateItemLink(id, a, { reference: "Chapter III", pageStart: 5, pageEnd: 8 });
    await collectionsService.reorderItems(id, [b, a]);
    expect((await collectionsService.listItems(id)).map(i => i.id)).toEqual([b, a]);
    const links = await collectionsService.items(id);
    for (const invalid of [[a, a], [a], [a, 999]]) {
      await expect(collectionsService.reorderItems(id, invalid)).rejects.toThrow();
      expect(await collectionsService.items(id)).toEqual(links);
    }
    const collection = (await collectionsService.get(id))!;
    await collectionsService.remove(id);
    await collectionsService.restore(collection, links);
    expect((await collectionsService.items(id)).map(({ itemId, position, reference, pageStart, pageEnd }) => ({ itemId, position, reference, pageStart, pageEnd }))).toEqual(links.map(({ itemId, position, reference, pageStart, pageEnd }) => ({ itemId, position, reference, pageStart, pageEnd })));
    expect(await db.library.get(a)).toBeDefined();
    await collectionsService.removeItems(id, [a]);
    expect(await db.library.get(a)).toBeDefined();
  });
  it("creates, lists, updates, and removes (detaching links)", async () => {
    const id = await collectionsService.create({ kind: "collection", name: "Op. 9", composer: "Chopin" });
    const item = await seedItem("Nocturne in B♭ minor");
    await collectionsService.addItems(id, [item]);

    expect((await collectionsService.list()).length).toBe(1);
    expect(await collectionsService.countItems(id)).toBe(1);

    await collectionsService.update(id, { catalog: "Op. 9" });
    expect((await collectionsService.get(id))!.catalog).toBe("Op. 9");

    await collectionsService.remove(id);
    expect((await collectionsService.list()).length).toBe(0);
    // Links are detached, item remains
    expect(await db.collectionItems.where("itemId").equals(item).count()).toBe(0);
    expect(await db.library.get(item)).toBeDefined();
  });

  it("setItemCollections diffs add and remove", async () => {
    const a = await collectionsService.create({ kind: "collection", name: "A" });
    const b = await collectionsService.create({ kind: "collection", name: "B" });
    const c = await collectionsService.create({ kind: "collection", name: "C" });
    const item = await seedItem("Piece");

    await collectionsService.setItemCollections(item, [a, b]);
    expect((await collectionsService.listForItem(item)).map((c) => c.id).sort())
      .toEqual([a, b].sort());

    await collectionsService.setItemCollections(item, [b, c]);
    const after = (await collectionsService.listForItem(item)).map((x) => x.id).sort();
    expect(after).toEqual([b, c].sort());
  });

  it("addItems is idempotent", async () => {
    const id = await collectionsService.create({ kind: "collection", name: "X" });
    const item = await seedItem("Piece");
    await collectionsService.addItems(id, [item]);
    await collectionsService.addItems(id, [item]);
    expect(await collectionsService.countItems(id)).toBe(1);
  });

  it("groupLibraryByCollection includes uncollected bucket and multi-membership", async () => {
    const a = await collectionsService.create({ kind: "collection", name: "Aaa" });
    const b = await collectionsService.create({ kind: "collection", name: "Bbb" });
    const i1 = await seedItem("In both");
    const i2 = await seedItem("Only A");
    const i3 = await seedItem("Uncollected");
    await collectionsService.setItemCollections(i1, [a, b]);
    await collectionsService.setItemCollections(i2, [a]);

    const groups = await collectionsService.groupLibraryByCollection("piece");
    // Last group is always Uncollected
    expect(groups[groups.length - 1].collection).toBeNull();
    expect(groups[groups.length - 1].items.map((i) => i.id)).toEqual([i3]);

    const groupA = groups.find((g) => g.collection?.id === a)!;
    const groupB = groups.find((g) => g.collection?.id === b)!;
    expect(groupA.items.map((i) => i.id).sort()).toEqual([i1, i2].sort());
    expect(groupB.items.map((i) => i.id)).toEqual([i1]);
  });

  it("uncollected bucket exists even when empty", async () => {
    const a = await collectionsService.create({ kind: "collection", name: "A" });
    const item = await seedItem("Piece");
    await collectionsService.setItemCollections(item, [a]);
    const groups = await collectionsService.groupLibraryByCollection("piece");
    expect(groups[groups.length - 1].collection).toBeNull();
    expect(groups[groups.length - 1].items).toEqual([]);
  });

  it("ignores non-repertoire items in grouping", async () => {
    const a = await collectionsService.create({ kind: "collection", name: "A" });
    const m = await seedItem("Theory", "theory");
    await collectionsService.addItems(a, [m]);
    const groups = await collectionsService.groupLibraryByCollection("piece");
    const groupA = groups.find((g) => g.collection?.id === a)!;
    expect(groupA.items.length).toBe(0);
  });
});
