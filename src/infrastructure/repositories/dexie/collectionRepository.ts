import { db } from "@/infrastructure/dexie/db";
import type { Collection, CollectionItem } from "@/domain/entities/collection";
import type { LibraryItem } from "@/domain/entities/library";
import type { CollectionKind, LibraryKind } from "@/domain/entities/common";
import { now } from "@/lib/date";
import { collectionInputSchema, collectionLinkInputSchema } from "@/lib/schemas";
import type { CollectionPort } from "@/domain/ports/collection";
const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;

async function requireCollection(id: number) {
  const row = await db.collections.get(id);
  if (!row || !active(row)) throw new Error("collection.error.missing");
  return row;
}
async function requireItems(ids: number[]) {
  const rows = await db.library.bulkGet(ids);
  if (rows.some(row => !row || !active(row))) throw new Error("library.error.missing");
}

export const collectionRepository = {
  async list(kind?: CollectionKind) { return (await db.collections.filter(row => active(row) && (!kind || row.kind === kind)).toArray()).sort((a, b) => a.name.localeCompare(b.name)); },
  get: (id: number) => db.collections.get(id),
  async create(row: Omit<Collection, "id">) { return db.collections.add({ ...row, ...collectionInputSchema.parse(row) }) as Promise<number>; },
  async update(id: number, patch: Partial<Collection>) {
    const row = await requireCollection(id);
    const data = collectionInputSchema.parse({ ...row, ...patch });
    await db.collections.update(id, { ...patch, ...data, updatedAt: now() });
  },
  async remove(id: number) {
    await db.transaction("rw", db.collections, db.collectionItems, async () => {
      await db.collectionItems.where("collectionId").equals(id).delete();
      await db.collections.update(id, { deletedAt: now(), updatedAt: now() });
    });
  },
  async restore(collection: Collection, links: Omit<CollectionItem, "id" | "createdAt">[]) {
    await db.transaction("rw", db.collections, db.collectionItems, db.library, async () => {
      collectionInputSchema.parse(collection);
      if (new Set(links.map(link => link.itemId)).size !== links.length || links.some(link => link.collectionId !== collection.id)) throw new Error("collection.error.order");
      await requireItems(links.map(link => link.itemId));
      await db.collections.put({ ...collection, deletedAt: undefined, updatedAt: now() });
      await db.collectionItems.where("collectionId").equals(collection.id!).delete();
      if (links.length) await db.collectionItems.bulkAdd(links.map(link => {
        const { id: _id, ...rest } = link as CollectionItem;
        return { ...rest, ...collectionLinkInputSchema.parse(link), createdAt: now() };
      }));
    });
  },
  async listForItem(itemId: number) {
    const links = await db.collectionItems.where("itemId").equals(itemId).toArray();
    const rows = await db.collections.where("id").anyOf(links.map(link => link.collectionId)).toArray();
    return rows.filter(active).sort((a, b) => a.name.localeCompare(b.name));
  },
  async items(collectionId: number) { return (await db.collectionItems.where("collectionId").equals(collectionId).toArray()).sort((a, b) => a.position - b.position || a.id - b.id); },
  async listItems(collectionId: number) {
    const links = await this.items(collectionId);
    const rows = await db.library.bulkGet(links.map(link => link.itemId));
    return rows.filter((item): item is LibraryItem => !!item && active(item));
  },
  async setItemCollections(itemId: number, collectionIds: number[]) {
    const wanted = new Set(collectionIds);
    await db.transaction("rw", db.collectionItems, db.collections, db.library, async () => {
      await requireItems([itemId]);
      for (const id of wanted) await requireCollection(id);
      const links = await db.collectionItems.where("itemId").equals(itemId).toArray();
      const have = new Set(links.map(link => link.collectionId));
      const remove = links.filter(link => !wanted.has(link.collectionId)).map(link => link.id);
      if (remove.length) await db.collectionItems.bulkDelete(remove);
      for (const id of wanted) if (!have.has(id)) await this.addItems(id, [itemId]);
    });
  },
  async addItems(collectionId: number, itemIds: number[]) {
    await db.transaction("rw", db.collectionItems, db.collections, db.library, async () => {
      await requireCollection(collectionId);
      const ids = [...new Set(itemIds)];
      await requireItems(ids);
      const links = await this.items(collectionId);
      const have = new Set(links.map(link => link.itemId));
      const add = ids.filter(id => !have.has(id));
      const start = links.reduce((max, link) => Math.max(max, link.position + 1), 0);
      if (add.length) await db.collectionItems.bulkAdd(add.map((itemId, i) => ({ collectionId, itemId, position: start + i, createdAt: now() })));
    });
  },
  async updateItemLink(collectionId: number, itemId: number, patch: Pick<CollectionItem, "reference" | "pageStart" | "pageEnd">) {
    await db.transaction("rw", db.collectionItems, db.collections, db.library, async () => {
      await requireCollection(collectionId);
      await requireItems([itemId]);
      const link = await db.collectionItems.where("[collectionId+itemId]").equals([collectionId, itemId]).first();
      if (!link) throw new Error("collection.error.missingLink");
      const data = collectionLinkInputSchema.parse({ ...link, ...patch });
      await db.collectionItems.update(link.id, { reference: data.reference, pageStart: data.pageStart, pageEnd: data.pageEnd });
    });
  },
  async reorderItems(collectionId: number, itemIds: number[]) {
    await db.transaction("rw", db.collections, db.collectionItems, async () => {
      await requireCollection(collectionId);
      const links = await this.items(collectionId);
      const byItem = new Map(links.map(link => [link.itemId, link.id]));
      if (itemIds.length !== links.length || new Set(itemIds).size !== itemIds.length || itemIds.some(id => !byItem.has(id))) throw new Error("collection.error.order");
      for (const [position, id] of itemIds.entries()) await db.collectionItems.update(byItem.get(id)!, { position });
    });
  },
  async removeItems(collectionId: number, itemIds: number[]) {
    const links = await db.collectionItems.where("collectionId").equals(collectionId).filter(link => itemIds.includes(link.itemId)).toArray();
    if (links.length) await db.collectionItems.bulkDelete(links.map(link => link.id));
  },
  countItems: (id: number) => db.collectionItems.where("collectionId").equals(id).count(),
  async groupLibraryByCollection(kind?: LibraryKind): Promise<{ collection: Collection | null; items: LibraryItem[] }[]> {
    const [collections, items, links] = await Promise.all([this.list(), db.library.filter(row => active(row) && (!kind || row.kind === kind)).toArray(), db.collectionItems.toArray()]);
    const byId = new Map(items.map(item => [item.id!, item]));
    const activeCollections = new Set(collections.map(row => row.id));
    const memberIds = new Set<number>();
    const grouped = new Map<number, LibraryItem[]>();
    for (const link of links.sort((a, b) => a.position - b.position || a.id - b.id)) {
      const item = byId.get(link.itemId);
      if (item && activeCollections.has(link.collectionId)) {
        memberIds.add(link.itemId);
        const group = grouped.get(link.collectionId) ?? [];
        group.push(item);
        grouped.set(link.collectionId, group);
      }
    }
    return [...collections.map(collection => ({ collection, items: grouped.get(collection.id!) ?? [] })), { collection: null, items: items.filter(item => !memberIds.has(item.id!)).sort((a, b) => a.title.localeCompare(b.title)) }];
  },
} satisfies CollectionPort;
