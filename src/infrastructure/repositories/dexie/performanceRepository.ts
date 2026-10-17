import { db } from "@/infrastructure/dexie/db";
import type { Draft } from "@/domain/entities/common";
import type { PerformanceEvent } from "@/domain/entities/performance";
import type { PerformancePort, RepertoirePort } from "@/domain/ports/performance";
import { enterRepertoire, isPerformable, scheduleNextReview } from "@/domain/logic/repertoireReview";
import { now, today } from "@/lib/date";

const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;

export const performanceRepository = {
  listEvents: () => db.performances.filter(active).toArray(),
  listLinks: () => db.performanceItems.toArray(),
  async upsertEvent(event: Draft<PerformanceEvent>) {
    if (event.id !== undefined) {
      await db.performances.put(event as PerformanceEvent);
      return event.id;
    }
    return await db.performances.add({ ...event, createdAt: event.createdAt ?? now() }) as number;
  },
  async removeEvent(id: number) {
    await db.transaction("rw", db.performances, db.performanceItems, async () => {
      await db.performanceItems.where("eventId").equals(id).delete();
      await db.performances.delete(id);
    });
  },
  async setEventItems(eventId: number, itemIds: number[]) {
    await db.transaction("rw", db.performanceItems, db.performances, db.library, async () => {
      const event = await db.performances.get(eventId);
      const ids = [...new Set(itemIds)];
      const items = await db.library.bulkGet(ids);
      if (!event || !active(event)) throw new Error("performances.error.missing");
      if (items.some(item => !item || !active(item) || !isPerformable(item.kind))) throw new Error("performances.error.material");
      const existing = await db.performanceItems.where("eventId").equals(eventId).toArray();
      const keep = new Set(itemIds);
      const removals = existing.filter((link) => !keep.has(link.itemId)).flatMap((link) => link.id === undefined ? [] : [link.id]);
      if (removals.length) await db.performanceItems.bulkDelete(removals);
      const present = new Set(existing.map((link) => link.itemId));
      const additions = ids.filter((itemId) => !present.has(itemId));
      if (additions.length) await db.performanceItems.bulkAdd(additions.map((itemId) => ({ eventId, itemId, createdAt: now() })));
    });
  },
} satisfies PerformancePort;

export const repertoireRepository = {
  async setInRepertoire(itemId: number, inRepertoire: boolean) {
    await db.transaction("rw", db.library, async () => {
      const item = await db.library.get(itemId);
      if (!item || !active(item)) throw new Error("library.error.missing");
      if (inRepertoire && !isPerformable(item.kind)) throw new Error("performances.error.material");
      await db.library.update(itemId, inRepertoire ? enterRepertoire(today(), now()) : { inRepertoire: false, nextReviewAt: undefined });
    });
  },
  async markReviewed(itemId: number, outcome: "good" | "ok" | "poor" = "good") {
    const item = await db.library.get(itemId);
    if (!item) return;
    await db.library.update(itemId, scheduleNextReview(item, today(), outcome));
  },
} satisfies RepertoirePort;
