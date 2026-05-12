import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { collectionsService } from "@/lib/services/collections";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedItem(title: string, kind: "repertoire" | "manual" = "repertoire") {
  return (await db.library.add({
    subjectId: 1, kind, title, createdAt: Date.now(),
  })) as number;
}

describe("collectionsService", () => {
  it("creates, lists, updates, and removes (detaching links)", async () => {
    const id = await collectionsService.create({ kind: "repertoire", name: "Op. 9", composer: "Chopin" });
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
    const a = await collectionsService.create({ kind: "repertoire", name: "A" });
    const b = await collectionsService.create({ kind: "repertoire", name: "B" });
    const c = await collectionsService.create({ kind: "repertoire", name: "C" });
    const item = await seedItem("Piece");

    await collectionsService.setItemCollections(item, [a, b]);
    expect((await collectionsService.listForItem(item)).map((c) => c.id).sort())
      .toEqual([a, b].sort());

    await collectionsService.setItemCollections(item, [b, c]);
    const after = (await collectionsService.listForItem(item)).map((x) => x.id).sort();
    expect(after).toEqual([b, c].sort());
  });

  it("addItems is idempotent", async () => {
    const id = await collectionsService.create({ kind: "repertoire", name: "X" });
    const item = await seedItem("Piece");
    await collectionsService.addItems(id, [item]);
    await collectionsService.addItems(id, [item]);
    expect(await collectionsService.countItems(id)).toBe(1);
  });

  it("groupRepertoireByCollection includes uncollected bucket and multi-membership", async () => {
    const a = await collectionsService.create({ kind: "repertoire", name: "Aaa" });
    const b = await collectionsService.create({ kind: "repertoire", name: "Bbb" });
    const i1 = await seedItem("In both");
    const i2 = await seedItem("Only A");
    const i3 = await seedItem("Uncollected");
    await collectionsService.setItemCollections(i1, [a, b]);
    await collectionsService.setItemCollections(i2, [a]);

    const groups = await collectionsService.groupRepertoireByCollection();
    // Last group is always Uncollected
    expect(groups[groups.length - 1].collection).toBeNull();
    expect(groups[groups.length - 1].items.map((i) => i.id)).toEqual([i3]);

    const groupA = groups.find((g) => g.collection?.id === a)!;
    const groupB = groups.find((g) => g.collection?.id === b)!;
    expect(groupA.items.map((i) => i.id).sort()).toEqual([i1, i2].sort());
    expect(groupB.items.map((i) => i.id)).toEqual([i1]);
  });

  it("uncollected bucket exists even when empty", async () => {
    const a = await collectionsService.create({ kind: "repertoire", name: "A" });
    const item = await seedItem("Piece");
    await collectionsService.setItemCollections(item, [a]);
    const groups = await collectionsService.groupRepertoireByCollection();
    expect(groups[groups.length - 1].collection).toBeNull();
    expect(groups[groups.length - 1].items).toEqual([]);
  });

  it("ignores non-repertoire items in grouping", async () => {
    const a = await collectionsService.create({ kind: "repertoire", name: "A" });
    const m = await seedItem("Manual", "manual");
    await collectionsService.addItems(a, [m]);
    const groups = await collectionsService.groupRepertoireByCollection();
    const groupA = groups.find((g) => g.collection?.id === a)!;
    expect(groupA.items.length).toBe(0);
  });
});
