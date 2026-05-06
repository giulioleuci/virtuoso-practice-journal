/** Library service — wraps library + segment operations. */
import { db, deleteLibraryItem, type LibraryItem, type Segment } from "@/lib/db";

export const libraryService = {
  async list(): Promise<LibraryItem[]> {
    return db.library.filter((i) => !i.deletedAt).toArray();
  },

  async get(id: number): Promise<LibraryItem | undefined> {
    return db.library.get(id);
  },

  async upsert(item: LibraryItem, segments: Omit<Segment, "id" | "itemId" | "createdAt">[] = []) {
    const now = Date.now();
    let id = item.id;
    if (id) {
      await db.library.put(item);
      await db.segments.where("itemId").equals(id).delete();
    } else {
      id = (await db.library.add({ ...item, createdAt: item.createdAt ?? now })) as number;
    }
    if (segments.length) {
      await db.segments.bulkAdd(
        segments.map((s) => ({ ...s, itemId: id!, createdAt: now })),
      );
    }
    return id!;
  },

  async remove(id: number) {
    return deleteLibraryItem(id);
  },
};
