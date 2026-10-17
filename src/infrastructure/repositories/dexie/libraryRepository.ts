import { db } from "@/infrastructure/dexie/db";
import type { Draft } from "@/domain/entities/common";
import type { LibraryItem, Segment, SegmentInput } from "@/domain/entities/library";
import type { LibraryPort } from "@/domain/ports/library";
import { isPerformable } from "@/domain/logic/repertoireReview";
import { now } from "@/lib/date";
import { libraryItemInputSchema, segmentInputSchema } from "@/lib/schemas";
import { collectionRepository } from "./collectionRepository";
const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;
async function hasSessions(itemId: number) {
  if (await db.sessions.where("itemId").equals(itemId).count()) return true;
  const taskIds = await db.tasks.where("itemId").equals(itemId).primaryKeys() as number[];
  return taskIds.length > 0 && (await db.sessions.where("taskId").anyOf(taskIds).count()) > 0;
}
async function hardDelete(itemId: number) {
  await db.transaction("rw", db.library, db.segments, db.tasks, db.collectionItems, db.performanceItems, async () => {
    await db.segments.where("itemId").equals(itemId).delete();
    await db.tasks.where("itemId").equals(itemId).delete();
    await db.collectionItems.where("itemId").equals(itemId).delete();
    await db.performanceItems.where("itemId").equals(itemId).delete();
    await db.library.delete(itemId);
  });
}
export const libraryRepository = {
  list: () => db.library.filter(active).toArray(),
  get: (id: number) => db.library.get(id),
  async upsert(item: Draft<LibraryItem>, segments?: SegmentInput[], collectionIds?: number[]) {
    const data = libraryItemInputSchema.parse(item);
    const inputs = segments?.map(segment => segmentInputSchema.parse(segment));
    const ts = now();
    return db.transaction("rw", [db.library, db.segments, db.subjects, db.techniques, db.tasks, db.sessions, db.recordings, db.collections, db.collectionItems, db.performanceItems], async () => {
      const subject = await db.subjects.get(data.subjectId);
      if (!subject || !active(subject)) throw new Error("library.error.subject");
      const techniqueIds = [...new Set([...(data.techniqueIds ?? []), ...(inputs?.flatMap(segment => segment.techniqueIds ?? []) ?? [])])];
      const techniques = await db.techniques.bulkGet(techniqueIds);
      if (techniques.some(technique => !technique || !active(technique) || technique.subjectId !== data.subjectId)) throw new Error("library.error.techniques");
      const previous = item.id === undefined ? undefined : await db.library.get(item.id);
      if (item.id !== undefined && (!previous || !active(previous))) throw new Error("library.error.missing");
      if (!isPerformable(data.kind) && (item.inRepertoire || previous?.inRepertoire || (item.id !== undefined && await db.performanceItems.where("itemId").equals(item.id).count() > 0))) throw new Error("library.error.performable");
      const existing = item.id === undefined ? [] : await db.segments.where("itemId").equals(item.id).toArray();
      const byId = new Map(existing.map(segment => [segment.id, segment]));
      const ids = inputs?.flatMap(segment => segment.id === undefined ? [] : [segment.id]) ?? [];
      if (new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) throw new Error("library.error.segment");
      const id = await db.library.put({ ...previous, ...item, ...data, createdAt: previous?.createdAt ?? item.createdAt ?? ts }) as number;
      if (inputs !== undefined) {
        const retained = new Set(ids);
        const removed = existing.filter(segment => !retained.has(segment.id));
        if (removed.length) {
          const [tasks, sessions, recordings] = await Promise.all([db.tasks.where("itemId").equals(id).toArray(), db.sessions.toArray(), db.recordings.toArray()]);
          const referenced = new Set([
            ...tasks.flatMap(task => task.plan.map(entry => entry.segmentId)),
            ...sessions.flatMap(session => [...session.marks.map(mark => mark.segmentId), ...(session.notStudied ?? [])]),
            ...recordings.map(recording => recording.segmentId),
          ]);
          for (const segment of removed) {
            if (referenced.has(segment.id)) await db.segments.update(segment.id, { deletedAt: segment.deletedAt ?? ts });
            else await db.segments.delete(segment.id);
          }
        }
        for (const segment of inputs) await db.segments.put({ ...segment, itemId: id, createdAt: segment.id === undefined ? ts : byId.get(segment.id)!.createdAt, deletedAt: undefined });
      }
      if (collectionIds !== undefined) await collectionRepository.setItemCollections(id, collectionIds);
      return id;
    });
  },
  async remove(id: number) { if (await hasSessions(id)) { await db.library.update(id, { deletedAt: now() }); return "soft" as const; } await hardDelete(id); return "hard" as const; },
  hasSessions, hardDelete,
  async restore(item: LibraryItem, segments: Segment[]) {
    return db.transaction("rw", db.library, db.segments, async () => {
      const id = await db.library.put({ ...item, deletedAt: undefined }) as number;
      if (segments.length) await db.segments.bulkPut(segments.map(segment => ({ ...segment, itemId: id })));
      return id;
    });
  },
} satisfies LibraryPort;
