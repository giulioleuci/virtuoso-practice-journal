import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { buildSessionSnapshot, buildLessonSnapshot } from "./snapshots";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("buildSessionSnapshot", () => {
  it("denormalizes subject, item, segments, techniques into an immutable copy", async () => {
    const subjectId = (await db.subjects.add({ name: "Violin", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({
      subjectId, kind: "repertoire", title: "Caprice 24", composer: "Paganini", createdAt: 2,
    })) as number;
    const seg1 = (await db.segments.add({ itemId, label: "Theme", layers: [], createdAt: 3 })) as number;
    const seg2 = (await db.segments.add({ itemId, label: "Var I", layers: [], createdAt: 4 })) as number;
    const tech = (await db.techniques.add({ subjectId, name: "Spiccato", createdAt: 5 })) as number;

    const snap = await buildSessionSnapshot({
      title: "Caprice", date: "2025-01-01", subjectId, itemId,
      segmentIds: [seg1, seg2], techniqueIds: [tech], targetBpm: 120, noteVal: "eighth",
      layers: ["slow"], done: false, createdAt: 0,
    });

    expect(snap.subjectName).toBe("Violin");
    expect(snap.itemTitle).toBe("Caprice 24");
    expect(snap.itemComposer).toBe("Paganini");
    expect(snap.segments?.map((s) => s.label).sort()).toEqual(["Theme", "Var I"]);
    expect(snap.techniqueNames).toEqual(["Spiccato"]);
    expect(snap.targetBpm).toBe(120);
    expect(snap.layers).toEqual(["slow"]);
  });

  it("falls back to em-dash when subject is missing", async () => {
    const snap = await buildSessionSnapshot({
      title: "Mystery", date: "2025-01-01", subjectId: 9999,
      done: false, createdAt: 0,
    });
    expect(snap.subjectName).toBe("—");
    expect(snap.itemTitle).toBeUndefined();
    expect(snap.segments).toBeUndefined();
  });

  it("includes collection name when task is collection-linked", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const collectionId = (await db.collections.add({
      kind: "repertoire", name: "Études Op. 10", createdAt: 1, updatedAt: 1,
    })) as number;
    const snap = await buildSessionSnapshot({
      title: "Op. 10 No. 1", date: "2025-01-01", subjectId, collectionId,
      done: false, createdAt: 0,
    });
    expect(snap.collectionName).toBe("Études Op. 10");
  });
});

describe("buildLessonSnapshot", () => {
  it("captures subject + teacher + frequency + piece titles", async () => {
    const subjectId = (await db.subjects.add({ name: "Cello", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({
      subjectId, kind: "repertoire", title: "Bach Suite 1", createdAt: 2,
    })) as number;

    const { snapshot, piecesPlayedTitles } = await buildLessonSnapshot(
      subjectId,
      { id: 1, subjectId, teacher: "Maestro",
        schedules: [{ dayOfWeek: 3, startTime: "10:00", endTime: "11:00", frequency: "weekly" }],
        startDate: "2025-01-01",
        color: "terracotta", createdAt: 1 },
      [itemId],
    );


    expect(snapshot.subjectName).toBe("Cello");
    expect(snapshot.teacher).toBe("Maestro");
    expect(snapshot.frequency).toBe("weekly");
    expect(piecesPlayedTitles).toEqual(["Bach Suite 1"]);
  });
});
