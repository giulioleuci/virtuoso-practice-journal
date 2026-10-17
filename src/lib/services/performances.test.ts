import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { LibraryKind } from "@/domain/entities/common";
import { isPerformable } from "@/domain/logic/repertoireReview";
import { performanceRepository, repertoireRepository } from "@/infrastructure/repositories/dexie/performanceRepository";
import { libraryRepository } from "@/infrastructure/repositories/dexie/libraryRepository";

beforeEach(async () => { await db.delete(); await db.open(); });

describe("performable materials", () => {
  it.each(["piece", "study", "technique", "exercise", "theory"] as LibraryKind[])("enforces eligibility for %s at the write boundary", async kind => {
    const itemId = await db.library.add({ subjectId: 1, kind, studyStatus: "not_started", title: kind, createdAt: 1 });
    const eventId = await db.performances.add({ name: "Recital", kind: "concert", date: "2026-10-17", createdAt: 1 });
    if (kind === "piece" || kind === "study") {
      expect(isPerformable(kind)).toBe(true);
      await performanceRepository.setEventItems(eventId, [itemId, itemId]);
      expect(await db.performanceItems.count()).toBe(1);
      await repertoireRepository.setInRepertoire(itemId, true);
      expect((await db.library.get(itemId))?.inRepertoire).toBe(true);
    } else {
      expect(isPerformable(kind)).toBe(false);
      await expect(repertoireRepository.setInRepertoire(itemId, true)).rejects.toThrow();
      await expect(performanceRepository.setEventItems(eventId, [itemId])).rejects.toThrow();
      expect(await db.performanceItems.count()).toBe(0);
    }
  });

  it("rejects missing/archived references and rolls back replacement of a program", async () => {
    const study = await db.library.add({ subjectId: 1, kind: "study", studyStatus: "not_started", title: "Study", createdAt: 1 });
    const exercise = await db.library.add({ subjectId: 1, kind: "exercise", studyStatus: "not_started", title: "Exercise", createdAt: 1 });
    const event = await db.performances.add({ name: "Recital", kind: "concert", date: "2026-10-17", createdAt: 1 });
    await performanceRepository.setEventItems(event, [study]);
    const previous = await db.performanceItems.toArray();
    for (const ids of [[study, exercise], [999]]) {
      await expect(performanceRepository.setEventItems(event, ids)).rejects.toThrow();
      expect(await db.performanceItems.toArray()).toEqual(previous);
    }
    await db.library.update(study, { deletedAt: 2 });
    await expect(performanceRepository.setEventItems(event, [study])).rejects.toThrow();
    await expect(repertoireRepository.setInRepertoire(study, true)).rejects.toThrow();
    await expect(performanceRepository.setEventItems(999, [])).rejects.toThrow();
  });

  it("blocks incompatible type changes until repertoire and program links are explicitly removed", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const id = await libraryRepository.upsert({ subjectId, kind: "study", studyStatus: "not_started", title: "Study", createdAt: 1 });
    const item = (await db.library.get(id))!;
    await repertoireRepository.setInRepertoire(id, true);
    const change = { ...item, inRepertoire: false, kind: "exercise" as const, title: "Changed" };
    await expect(libraryRepository.upsert(change)).rejects.toThrow();
    expect((await db.library.get(id))?.title).toBe("Study");
    await repertoireRepository.setInRepertoire(id, false);
    const event = await db.performances.add({ name: "Recital", kind: "concert", date: "2026-10-17", createdAt: 1 });
    await performanceRepository.setEventItems(event, [id]);
    await expect(libraryRepository.upsert(change)).rejects.toThrow();
    await performanceRepository.setEventItems(event, []);
    await libraryRepository.upsert(change);
    expect((await db.library.get(id))?.kind).toBe("exercise");
  });
});
