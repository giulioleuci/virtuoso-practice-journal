import { db } from "@/infrastructure/dexie/db";
import type { Draft } from "@/domain/entities/common";
import type { PerformanceEvent } from "@/domain/entities/performance";
import type { PerformancePort, RepertoirePort } from "@/domain/ports/performance";
import { enterRepertoire, scheduleNextReview } from "@/domain/logic/repertoireReview";
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
    await db.transaction("rw", db.performanceItems, async () => {
      const existing = await db.performanceItems.where("eventId").equals(eventId).toArray();
      const keep = new Set(itemIds);
      const removals = existing.filter((link) => !keep.has(link.itemId)).flatMap((link) => link.id === undefined ? [] : [link.id]);
      if (removals.length) await db.performanceItems.bulkDelete(removals);
      const present = new Set(existing.map((link) => link.itemId));
      const additions = itemIds.filter((itemId) => !present.has(itemId));
      if (additions.length) await db.performanceItems.bulkAdd(additions.map((itemId) => ({ eventId, itemId, createdAt: now() })));
    });
  },
} satisfies PerformancePort;

export const repertoireRepository = {
  async setInRepertoire(itemId: number, inRepertoire: boolean) {
    if (!inRepertoire) {
      await db.library.update(itemId, { inRepertoire: false, nextReviewAt: undefined });
      return;
    }
    await db.library.update(itemId, enterRepertoire(today(), now()));
  },
  async markReviewed(itemId: number, outcome: "good" | "ok" | "poor" = "good") {
    const item = await db.library.get(itemId);
    if (!item) return;
    await db.library.update(itemId, scheduleNextReview(item, today(), outcome));
  },
} satisfies RepertoirePort;
