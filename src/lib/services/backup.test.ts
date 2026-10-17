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
    await db.library.add({ subjectId, kind: "piece", studyStatus: "not_started", title: "Sonata", createdAt: 2 });

    const json = await backupService.exportAll();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(4);
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
      version: 4,
      data: { subjects: [{ id: 1, name: "New", type: "theory", createdAt: 9 }] },
    });
    await backupService.importAll(json);
    const subjects = await db.subjects.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("New");
  });

  it("round-trips per-section marks on sessions", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ subjectId, kind: "piece", studyStatus: "not_started", title: "Sonata", createdAt: 2 })) as number;
    const taskId = (await db.tasks.add({
      date: "2026-01-01", subjectId, itemId, title: "Sonata mvt 1", plan: [], done: true, createdAt: 3,
    })) as number;
    await db.segments.bulkAdd([{ id: 10, itemId, label: "Exposition", position: 0, layers: [], createdAt: 1 }, { id: 11, itemId, label: "Development", position: 1, layers: [], createdAt: 1 }]);
    await db.techniques.add({ id: 5, subjectId, name: "Legato", createdAt: 1 });
    await db.sessions.add({
      taskId, subjectId, itemId, linkType: "item", date: "2026-01-01",
      marks: [
        { segmentId: 10, bpm: 96, confidence: 4, layers: ["RH"], techniques: [] },
        { segmentId: 11, bpm: 72, confidence: 3, layers: [], techniques: [5] },
      ],
      snapshot: {
        taskTitle: "Sonata mvt 1", subjectName: "Piano",
        segments: [{ id: "10", label: "Exposition" }, { id: "11", label: "Development" }],
      },
      createdAt: 4,
    });

    const json = await backupService.exportAll();
    await backupService.wipeAll();
    await backupService.importAll(json);

    const [restored] = await db.sessions.toArray();
    expect(restored?.marks.find((m) => m.segmentId === 10)?.bpm).toBe(96);
    expect(restored?.marks.find((m) => m.segmentId === 10)?.layers).toEqual(["RH"]);
    expect(restored?.marks.find((m) => m.segmentId === 11)?.techniques).toEqual([5]);
    expect(restored?.snapshot?.segments?.[0]?.label).toBe("Exposition");
  });

  it("rejects v3 and missing versions without touching existing data", async () => {
    await db.subjects.add({ name: "Existing", type: "instrument", createdAt: 1 });
    for (const version of [3, undefined]) {
      await expect(backupService.importAll(JSON.stringify({ version, data: {} }))).rejects.toThrow();
      expect((await db.subjects.toArray())[0]?.name).toBe("Existing");
    }
  });

  it("rejects unsupported future versions", async () => {
    const json = JSON.stringify({ version: 99, data: {} });
    await expect(backupService.importAll(json)).rejects.toThrow(/version/i);
  });
});
