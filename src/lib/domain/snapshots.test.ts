import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { buildSessionSnapshot, buildLessonSnapshot } from "./snapshots";
import { LogSessionUseCase } from "@/application/useCases/logSession";
import { sessionRepository } from "@/infrastructure/repositories/dexie/sessionRepository";
import { marksFromPlan } from "@/domain/logic/plan";
import { practiceCsv } from "@/application/useCases/exportCsv";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("buildSessionSnapshot", () => {
  it("preserves bar ranges and distinct target/result figures after the source changes", async () => {
    const subjectId = await db.subjects.add({ name: "Solfeggio", type: "theory", createdAt: 1 });
    const itemId = await db.library.add({ subjectId, kind: "exercise", studyStatus: "not_started", title: "Reading", createdAt: 1 });
    const segmentId = await db.segments.add({ itemId, label: "Pickup", barStart: 0, barEnd: 8, position: 0, layers: [], createdAt: 1 });
    const plan = [{ segmentId, bpm: 88, noteVal: "quarter" as const, layers: [], techniques: [] }];
    const id = await new LogSessionUseCase(sessionRepository).execute({ subjectId, itemId, linkType: "item", title: "Reading", plan }, { date: "2026-10-17", marks: marksFromPlan(plan).map(mark => ({ ...mark, bpm: 56, noteVal: "eighth", confidence: 4 })) });
    await db.segments.update(segmentId, { label: "Renamed", barStart: 1, barEnd: 16 });
    const session = (await db.sessions.get(id))!;
    expect(session.snapshot?.segments).toEqual([{ id: String(segmentId), label: "Pickup", barStart: 0, barEnd: 8 }]);
    expect(session.marks[0]).toMatchObject({ bpm: 56, noteVal: "eighth", targetBpm: 88, targetNoteVal: "quarter" });
    const csv = practiceCsv([session]).results.replace("\uFEFF", "").split("\r\n");
    const row = Object.fromEntries(csv[0].split(",").map((column, i) => [column, csv[1].split(",")[i]]));
    expect(row).toMatchObject({ bar_start: "0", bar_end: "8", target_bpm: "88", target_note_value: "quarter" });
  });
  it("denormalizes subject, item, segments, techniques into an immutable copy", async () => {
    const subjectId = (await db.subjects.add({ name: "Violin", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ studyStatus: "not_started",
      subjectId, kind: "piece", title: "Caprice 24", composer: "Paganini", createdAt: 2,
    })) as number;
    const seg1 = (await db.segments.add({ position: 0, itemId, label: "Theme", layers: [], createdAt: 3 })) as number;
    const seg2 = (await db.segments.add({ position: 0, itemId, label: "Var I", layers: [], createdAt: 4 })) as number;
    const tech = (await db.techniques.add({ subjectId, name: "Spiccato", createdAt: 5 })) as number;

    const snap = await buildSessionSnapshot({
      title: "Caprice", date: "2025-01-01", subjectId, itemId,
      plan: [seg1, seg2].map((segmentId) => ({ segmentId, bpm: 120, noteVal: "eighth" as const, layers: ["slow"], techniques: [tech] })),
      done: false, createdAt: 0,
    });

    expect(snap.subjectName).toBe("Violin");
    expect(snap.itemTitle).toBe("Caprice 24");
    expect(snap.itemComposer).toBe("Paganini");
    expect(snap.segments?.map((s) => s.label).sort()).toEqual(["Theme", "Var I"]);
    expect(snap.techniqueNames).toEqual(["Spiccato"]);
  });

  it("falls back to em-dash when subject is missing", async () => {
    const snap = await buildSessionSnapshot({
      title: "Mystery", date: "2025-01-01", subjectId: 9999,
      plan: [], done: false, createdAt: 0,
    });
    expect(snap.subjectName).toBe("—");
    expect(snap.itemTitle).toBeUndefined();
    expect(snap.segments).toBeUndefined();
  });

  it("includes collection name when task is collection-linked", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const collectionId = (await db.collections.add({
      kind: "collection", name: "Études Op. 10", createdAt: 1, updatedAt: 1,
    })) as number;
    const snap = await buildSessionSnapshot({
      title: "Op. 10 No. 1", date: "2025-01-01", subjectId, collectionId,
      plan: [], done: false, createdAt: 0,
    });
    expect(snap.collectionName).toBe("Études Op. 10");
  });
});

describe("buildLessonSnapshot", () => {
  it("captures subject + teacher + frequency + piece titles", async () => {
    const subjectId = (await db.subjects.add({ name: "Cello", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ studyStatus: "not_started",
      subjectId, kind: "piece", title: "Bach Suite 1", createdAt: 2,
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
