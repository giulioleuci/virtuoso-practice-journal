import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { backupService } from "./backup";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("backupService export / import", () => {
  it("round-trips every table", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 2 });

    const json = await backupService.exportAll();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.data.subjects).toHaveLength(1);
    expect(parsed.data.library).toHaveLength(1);

    await backupService.wipeAll();
    expect(await db.subjects.count()).toBe(0);

    await backupService.importAll(json);
    const subjects = await db.subjects.toArray();
    const items = await db.library.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("Piano");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Sonata");
  });

  it("rejects payloads with the wrong shape", async () => {
    await expect(backupService.importAll("not json")).rejects.toThrow();
    await expect(backupService.importAll(JSON.stringify({ data: { subjects: "no" } }))).rejects.toThrow();
  });

  it("replaces existing data entirely on import", async () => {
    await db.subjects.add({ name: "Old", type: "instrument", createdAt: 1 });
    const json = JSON.stringify({
      version: 1,
      data: { subjects: [{ name: "New", type: "theory", createdAt: 9 }] },
    });
    await backupService.importAll(json);
    const subjects = await db.subjects.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("New");
  });

  it("round-trips per-segment metrics on sessions", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 2 })) as number;
    const taskId = (await db.tasks.add({
      date: "2026-01-01", subjectId, itemId, title: "Sonata mvt 1", done: true, createdAt: 3,
    })) as number;
    await db.sessions.add({
      taskId, date: "2026-01-01", quality: "well",
      snapshot: {
        taskTitle: "Sonata mvt 1", subjectName: "Piano",
        segments: [{ id: "10", label: "Exposition" }, { id: "11", label: "Development" }],
      },
      segmentMetrics: {
        "10": { quality: "great", bpmReached: 96, confidence: 4, layersUsed: ["RH"], layerScores: { RH: 82 } },
        "11": { quality: "improve", bpmReached: 72, confidence: 3, techniquesUsed: [5], techniqueScores: { 5: 55 } },
      },
      createdAt: 4,
    });

    const json = await backupService.exportAll();
    await backupService.wipeAll();
    await backupService.importAll(json);

    const [restored] = await db.sessions.toArray();
    expect(restored?.segmentMetrics?.["10"]?.bpmReached).toBe(96);
    expect(restored?.segmentMetrics?.["10"]?.layerScores?.RH).toBe(82);
    expect(restored?.segmentMetrics?.["11"]?.techniqueScores?.[5]).toBe(55);
    expect(restored?.snapshot?.segments?.[0]?.label).toBe("Exposition");
  });

  it("accepts legacy v1 backup payloads", async () => {
    const json = JSON.stringify({
      version: 1,
      data: { subjects: [{ name: "Legacy", type: "instrument", createdAt: 1 }] },
    });
    await backupService.importAll(json);
    expect((await db.subjects.toArray())[0]?.name).toBe("Legacy");
  });

  it("rejects unsupported future versions", async () => {
    const json = JSON.stringify({ version: 99, data: {} });
    await expect(backupService.importAll(json)).rejects.toThrow(/version/i);
  });
});
