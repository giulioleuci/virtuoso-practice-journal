import { describe, expect, it } from "vitest";
import type { SegmentMark } from "../entities/common";
import { carryMarksToPlan, followUpTasks, latestMarks, marksFromPlan, planFromHistory, restartFrom, sharesSection, syncPlan, tempoProposal } from "./plan";

const e = (segmentId: number | undefined, bpm: number) => ({ segmentId, bpm, layers: [], techniques: [] });

describe("carryMarksToPlan", () => {
  const next = [e(1, 60), e(2, 70)];
  const marks = [
    { ...e(1, 84), noteVal: "dotted-quarter" as const, layers: ["rhythm"], techniques: [3], confidence: 4, mood: 2, focus: 5 },
    { segmentId: 2, layers: [], techniques: [], confidence: 3 },
  ];

  it("changes only the picked tempos and never copies ratings", () => {
    const out = carryMarksToPlan(next, marks, { tempo: new Set([1]), extras: false });
    expect(out[0]).toEqual({ segmentId: 1, bpm: 84, noteVal: "dotted-quarter", layers: [], techniques: [] });
    expect(out[1]).toEqual(next[1]);
  });

  it("keeps the planned tempo when none was reached and copies layers only on request", () => {
    const out = carryMarksToPlan(next, marks, { tempo: new Set([1, 2]), extras: true });
    expect(out[1]).toEqual({ segmentId: 2, bpm: 70, layers: [], techniques: [] });
    expect(out[0]).toMatchObject({ layers: ["rhythm"], techniques: [3] });
  });

  it("proposes only sections whose reached tempo differs", () => {
    expect(tempoProposal(next, marks)).toEqual([1]);
    expect(sharesSection(next, marks)).toBe(true);
    expect(sharesSection([e(9, 1)], marks)).toBe(false);
  });
});

describe("restartFrom", () => {
  it("copies musical parameters of the last result and no rating", () => {
    const out = restartFrom([{ segmentId: 1, layers: [], techniques: [] }], [{ ...e(1, 90), layers: ["LH"], techniques: [2], confidence: 5, mood: 1, focus: 1 }]);
    expect(out).toEqual([{ segmentId: 1, bpm: 90, layers: ["LH"], techniques: [2] }]);
  });
});

describe("syncPlan", () => {
  it("inherits a complete material tempo and replaces it only with a complete section tempo", () => {
    const item = { targetBpm: 88, noteVal: "quarter" as const, techniqueIds: [9] };
    expect(syncPlan([], [{ id: 1 }], item)[0]).toEqual({ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] });
    expect(syncPlan([], [{ id: 1, targetBpm: 56, noteVal: "eighth" }], item)[0]).toMatchObject({ bpm: 56, noteVal: "eighth" });
    expect(syncPlan([], [{ id: 1, targetBpm: 56 }], item)[0]).toMatchObject({ bpm: 88, noteVal: "quarter" });
    expect(syncPlan([], [{ id: 1 }])[0].bpm).toBeUndefined();
    const saved = [{ segmentId: 1, bpm: 100, noteVal: "half" as const, layers: [], techniques: [] }];
    expect(syncPlan(saved, [{ id: 1 }], item)[0]).toBe(saved[0]);
  });

  it("keeps the historical target figure when the reached figure changes", () => {
    const [mark] = marksFromPlan([{ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] }]);
    mark.noteVal = "eighth";
    expect(mark).toMatchObject({ targetBpm: 88, targetNoteVal: "quarter", noteVal: "eighth" });
  });
  it("keeps edited entries for still-selected sections and seeds new ones", () => {
    const edited = [{ segmentId: 1, bpm: 90, layers: ["RH"], techniques: [] }];
    const out = syncPlan(edited, [{ id: 1, targetBpm: 60 }, { id: 2, targetBpm: 70, noteVal: "eighth", layers: ["LH"], techniqueIds: [4] }]);
    expect(out[0]).toBe(edited[0]);
    expect(out[1]).toEqual({ segmentId: 2, bpm: 70, noteVal: "eighth", layers: ["LH"], techniques: [4] });
  });
  it("falls back to a whole-task entry from the item", () => {
    expect(syncPlan([], [], { targetBpm: 100 })).toEqual([{ segmentId: undefined, bpm: 100, noteVal: undefined, layers: [], techniques: [] }]);
  });
});

describe("followUpTasks", () => {
  const base = { subjectId: 1, title: "Ballade", itemId: 5, collectionId: undefined, done: false, skipped: undefined };
  const task = { id: 1, date: "2026-10-14", subjectId: 1, title: "Ballade", itemId: 5, collectionId: undefined };
  const marks = [{ ...e(7, 80) }];
  it("keeps open later tasks of the same item that share a section", () => {
    const later = { ...base, id: 2, date: "2026-10-15", plan: [e(7, 60)] };
    const otherSection = { ...base, id: 3, date: "2026-10-15", plan: [e(8, 60)] };
    const otherItem = { ...base, id: 4, date: "2026-10-15", itemId: 6, plan: [e(7, 60)] };
    const past = { ...base, id: 5, date: "2026-10-13", plan: [e(7, 60)] };
    const done = { ...base, id: 6, date: "2026-10-16", done: true, plan: [e(7, 60)] };
    const sooner = { ...base, id: 7, date: "2026-10-14", plan: [e(7, 60)] };
    expect(followUpTasks(task, marks, [later, otherSection, otherItem, past, done, sooner]).map((t) => t.id)).toEqual([7, 2]);
  });
});

describe("planFromHistory", () => {
  const session = (date: string, ...marks: SegmentMark[]) => ({ date, createdAt: 1, marks });
  const latest = latestMarks([session("2026-10-02", e(1, 90)), session("2026-10-01", e(1, 50), e(2, 70)), session("2026-10-03", { segmentId: 3, layers: [], techniques: [] })]);

  it("takes each section's newest reached tempo, whichever session holds it", () => {
    expect(planFromHistory([e(1, 100), e(2, 100), e(3, 100), e(4, 100)], latest).map((x) => x.bpm)).toEqual([90, 70, 100, 100]);
  });

  it("leaves sections under a tempo progression alone", () => {
    const owned = { ...e(1, 100), progression: { id: 1, cycle: 1, minConfidence: 5 } };
    expect(planFromHistory([owned], latest)).toEqual([owned]);
  });
});
