import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "./db";
import { seedSampleData } from "./sampleData";
import { seedGuitarSampleData } from "./sampleDataGuitar";
import { backupService } from "./services/backup";
import { isPerformable } from "@/domain/logic/repertoireReview";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import type { Session } from "@/domain/entities/session";

describe("study sample data", () => {
  it.each([["complete", seedSampleData], ["guitar", seedGuitarSampleData]] as const)("seeds %s with five types and a mixed manual using valid v4 data", async (name, seed) => {
    await seed();
    const items = await db.library.toArray();
    expect(new Set(items.map(item => item.kind))).toEqual(new Set(["piece", "study", "technique", "exercise", "theory"]));
    const manuals = await db.collections.where("kind").equals("manual").toArray();
    const links = await db.collectionItems.toArray();
    expect(manuals.some(manual => new Set(links.filter(link => link.collectionId === manual.id).map(link => items.find(item => item.id === link.itemId)!.kind)).size > 1)).toBe(true);
    const segments = await db.segments.toArray();
    expect(segments.some(s => s.barStart !== undefined && s.targetBpm === undefined && items.find(i => i.id === s.itemId)?.targetBpm !== undefined)).toBe(true);
    expect(segments.some(s => s.barStart !== undefined && s.targetBpm !== undefined)).toBe(true);
    expect(items.some(i => i.kind === "exercise" && i.targetBpm === undefined)).toBe(true);
    expect(items.some(i => i.kind === "theory" && i.targetBpm === undefined)).toBe(true);
    if (name === "complete") {
      const study = items.find(i => i.kind === "study" && i.inRepertoire)!;
      expect(study).toBeDefined();
      expect(await db.performanceItems.where("itemId").equals(study.id!).count()).toBeGreaterThan(0);
      expect(links.filter(link => link.itemId === study.id).length).toBeGreaterThan(1);
      const history = await dexiePresentationReads.read<Session[]>("sessions.segmentHistory", [study.id]);
      expect(history.length).toBeGreaterThan(0);
      expect(new Set(history.map(s => s.id)).size).toBe(history.length);
      expect(history).toEqual(await db.sessions.where("itemId").equals(study.id!).toArray());
    } else {
      expect(await db.tasks.count()).toBe(0);
      expect(await db.sessions.count()).toBe(0);
      expect(await db.lessons.count()).toBe(0);
    }
    for (const link of await db.performanceItems.toArray()) expect(isPerformable(items.find(i => i.id === link.itemId)!.kind)).toBe(true);
    const backup = await backupService.exportAll();
    expect(JSON.parse(backup).version).toBe(4);
    await backupService.importAll(backup);
    expect(await db.library.toArray()).toEqual(items);
  });
});
