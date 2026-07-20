import { db } from "@/infrastructure/dexie/db";
import type { Draft } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { LibraryPort } from "@/domain/ports/library";
import { now } from "@/lib/date";
const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;
async function hasSessions(itemId: number) { const taskIds = await db.tasks.where("itemId").equals(itemId).primaryKeys() as number[]; return taskIds.length > 0 && (await db.sessions.where("taskId").anyOf(taskIds).count()) > 0; }
async function hardDelete(itemId: number) { await db.transaction("rw", db.library, db.segments, db.tasks, async () => { await db.segments.where("itemId").equals(itemId).delete(); await db.tasks.where("itemId").equals(itemId).delete(); await db.library.delete(itemId); }); }
export const libraryRepository = {
  list: () => db.library.filter(active).toArray(), get: (id: number) => db.library.get(id),
  async upsert(item: Draft<LibraryItem>, segments: Omit<Segment, "id" | "itemId" | "createdAt">[] = []) { const ts = now(); let id: number; await db.transaction("rw", db.library, db.segments, async () => { if (item.id !== undefined) { await db.library.put(item); await db.segments.where("itemId").equals(item.id).delete(); id = item.id; } else id = await db.library.add({ ...item, createdAt: item.createdAt ?? ts }) as number; if (segments.length) await db.segments.bulkAdd(segments.map((segment) => ({ ...segment, itemId: id, createdAt: ts }))); }); return id!; },
  async remove(id: number) { if (await hasSessions(id)) { await db.library.update(id, { deletedAt: now() }); return "soft" as const; } await hardDelete(id); return "hard" as const; }, hasSessions, hardDelete,
  async restore(item: LibraryItem, segments: Segment[]) { const { id: _id, ...rest } = item; let id = 0; await db.transaction("rw", db.library, db.segments, async () => { id = await db.library.add(rest) as number; if (segments.length) await db.segments.bulkAdd(segments.map(({ id: _segmentId, ...segment }) => ({ ...segment, itemId: id }))); }); return id; },
} satisfies LibraryPort & Record<string, unknown>;
