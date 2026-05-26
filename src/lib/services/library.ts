/** Library service — wraps library + segment operations. */
import { db, type LibraryItem, type Segment } from "@/lib/db";

/** Soft-delete a library item if any of its tasks have logged sessions; otherwise hard-delete. */
async function deleteLibraryItem(itemId: number): Promise<"soft" | "hard"> {
  const taskIds = (await db.tasks.where("itemId").equals(itemId).primaryKeys()) as number[];
  const hasSession = taskIds.length
    ? (await db.sessions.where("taskId").anyOf(taskIds).count()) > 0
    : false;
  if (hasSession) {
    await db.library.update(itemId, { deletedAt: Date.now() });
    return "soft";
  }
  await db.transaction("rw", db.library, db.segments, db.tasks, async () => {
    await db.segments.where("itemId").equals(itemId).delete();
    await db.tasks.where("itemId").equals(itemId).delete();
    await db.library.delete(itemId);
  });
  return "hard";
}

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
