/** Collections service — repertoire grouping (many-to-many). */
import { db, type Collection, type LibraryItem } from "@/lib/db";
import { collectionInputSchema, type CollectionInput } from "@/lib/schemas";
import { notDeleted, now, resolveMany } from "./_shared";

export const collectionsService = {
  async list(kind?: import("@/lib/db").LibraryKind): Promise<Collection[]> {
    const rows = await db.collections.filter((c) => notDeleted(c) && (!kind || c.kind === kind)).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: number): Promise<Collection | undefined> {
    return db.collections.get(id);
  },

  async create(input: CollectionInput): Promise<number> {
    const data = collectionInputSchema.parse(input);
    const ts = now();
    const row: Collection = {
      kind: data.kind,
      name: data.name,
      composer: data.composer,
      catalog: data.catalog,
      notes: data.notes,
      color: data.color,
      defaultSubjectId: data.defaultSubjectId,
      createdAt: ts,
      updatedAt: ts,
    };
    return (await db.collections.add(row)) as number;
  },

  async update(id: number, patch: Partial<CollectionInput>): Promise<void> {
    const merged = { ...(await db.collections.get(id)), ...patch } as Collection;
    collectionInputSchema.parse({
      kind: merged.kind,
      name: merged.name,
      composer: merged.composer,
      catalog: merged.catalog,
      notes: merged.notes,
      color: merged.color,
      defaultSubjectId: merged.defaultSubjectId,
    });
    await db.collections.update(id, { ...patch, updatedAt: now() });
  },

  /** Detach all linked items, then soft-delete the collection. */
  async remove(id: number): Promise<void> {
    await db.transaction("rw", db.collections, db.collectionItems, async () => {
      await db.collectionItems.where("collectionId").equals(id).delete();
      await db.collections.update(id, { deletedAt: now(), updatedAt: now() });
    });
  },

  /** Undo a soft-delete: un-delete the collection and re-attach saved item links. */
  async restore(collection: Collection, links: { collectionId: number; itemId: number; position?: number }[]): Promise<void> {
    const ts = now();
    const { deletedAt: _d, ...rest } = collection;
    await db.transaction("rw", db.collections, db.collectionItems, async () => {
      await db.collections.put({ ...rest, deletedAt: undefined, updatedAt: ts });
      if (links.length) {
        await db.collectionItems.bulkAdd(links.map((l) => ({ ...l, createdAt: ts })));
      }
    });
  },

  /** All non-deleted collections an item belongs to. */
  async listForItem(itemId: number): Promise<Collection[]> {
    const cols = await resolveMany(db.collectionItems, "itemId", itemId, "collectionId", db.collections);
    return cols.sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Repertoire items in a collection (excluding soft-deleted items). */
  async listItems(collectionId: number): Promise<LibraryItem[]> {
    const items = await resolveMany(db.collectionItems, "collectionId", collectionId, "itemId", db.library);
    return items.filter((i) => i.kind === "repertoire");
  },

  /** Replace the full set of collection memberships for one item. */
  async setItemCollections(itemId: number, collectionIds: number[]): Promise<void> {
    const target = new Set(collectionIds);
    await db.transaction("rw", db.collectionItems, async () => {
      const existing = await db.collectionItems.where("itemId").equals(itemId).toArray();
      const existingIds = new Set(existing.map((l) => l.collectionId));
      const toRemove = existing.filter((l) => !target.has(l.collectionId)).map((l) => l.id!);
      const toAdd = [...target].filter((cid) => !existingIds.has(cid));
      if (toRemove.length) await db.collectionItems.bulkDelete(toRemove);
      if (toAdd.length) {
        const ts = now();
        await db.collectionItems.bulkAdd(
          toAdd.map((collectionId) => ({ collectionId, itemId, createdAt: ts })),
        );
      }
    });
  },

  /** Add many items to one collection (idempotent). */
  async addItems(collectionId: number, itemIds: number[]): Promise<void> {
    if (!itemIds.length) return;
    await db.transaction("rw", db.collectionItems, async () => {
      const existing = await db.collectionItems.where("collectionId").equals(collectionId).toArray();
      const have = new Set(existing.map((l) => l.itemId));
      const toAdd = itemIds.filter((id) => !have.has(id));
      if (toAdd.length) {
        const ts = now();
        await db.collectionItems.bulkAdd(
          toAdd.map((itemId) => ({ collectionId, itemId, createdAt: ts })),
        );
      }
    });
  },

  async removeItems(collectionId: number, itemIds: number[]): Promise<void> {
    if (!itemIds.length) return;
    const links = await db.collectionItems
      .where("collectionId").equals(collectionId)
      .filter((l) => itemIds.includes(l.itemId))
      .toArray();
    if (links.length) await db.collectionItems.bulkDelete(links.map((l) => l.id!));
  },

  async countItems(collectionId: number): Promise<number> {
    return db.collectionItems.where("collectionId").equals(collectionId).count();
  },

  /**
   * Grouped library view by collection, scoped to one kind. An item appears in EVERY
   * collection of that kind it belongs to. Items with zero memberships go into a
   * synthetic "Uncollected" bucket (collection === null).
   */
  async groupLibraryByCollection(
    kind: import("@/lib/db").LibraryKind = "repertoire"
  ): Promise<{ collection: Collection | null; items: LibraryItem[] }[]> {
    const [collections, items, links] = await Promise.all([
      collectionsService.list(kind),
      db.library.where("kind").equals(kind).filter(notDeleted).toArray(),
      db.collectionItems.toArray(),
    ]);
    const itemsById = new Map(items.map((i) => [i.id!, i]));
    const linksByCollection = new Map<number, number[]>();
    const itemsWithMembership = new Set<number>();
    for (const l of links) {
      if (!itemsById.has(l.itemId)) continue;
      itemsWithMembership.add(l.itemId);
      const arr = linksByCollection.get(l.collectionId) ?? [];
      arr.push(l.itemId);
      linksByCollection.set(l.collectionId, arr);
    }
    const groups = collections.map((c) => ({
      collection: c,
      items: (linksByCollection.get(c.id!) ?? [])
        .map((id) => itemsById.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title)),
    }));
    const uncollected = items
      .filter((i) => !itemsWithMembership.has(i.id!))
      .sort((a, b) => a.title.localeCompare(b.title));
    return [...groups, { collection: null, items: uncollected }];
  },
};
