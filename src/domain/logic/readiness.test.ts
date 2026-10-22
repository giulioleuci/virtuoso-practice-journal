import { describe, expect, it } from "vitest";
import type { Session } from "../entities/session";
import { pieceEvidence } from "./readiness";

const mk = (id: number, date: string, marks: Session["marks"], createdAt = 1): Session => ({ id, date, marks, createdAt });
const m = (segmentId: number | undefined, extra: Partial<Session["marks"][number]> = {}) => ({ segmentId, layers: [], techniques: [], ...extra });

describe("pieceEvidence", () => {
  it("counts rated sections against the current ones and keeps missing apart from low", () => {
    const segments = [{ id: 1, label: "A" }, { id: 2, label: "B" }, { id: 3, label: "C" }];
    const e = pieceEvidence({ targetBpm: 100 }, segments, [
      mk(1, "2026-10-01", [m(1, { confidence: 2, bpm: 80, noteVal: "quarter" })]),
      mk(2, "2026-10-03", [m(2)]),
      mk(3, "2026-10-03", [m(1, { confidence: 4 })], 2),
      mk(4, "2026-09-01", [m(99, { confidence: 5 })]), // section deleted since: never counted
    ]);
    expect(e).toMatchObject({ total: 3, rated: 1, toDo: ["C"], lowConfidence: [], lastStudied: "2026-10-03", targetBpm: 100 });
    expect(e.sections[0]).toMatchObject({ lastConfidence: { value: 4, date: "2026-10-03" }, lastTempo: { bpm: 80, date: "2026-10-01" } });
    expect(e.sections[1].lastConfidence).toBeUndefined();
    expect(e.sections[1].lastStudied).toBe("2026-10-03");
  });

  it("breaks same-day ties by creation time, then id", () => {
    const e = pieceEvidence({}, [{ id: 1, label: "A" }], [mk(2, "2026-10-01", [m(1, { confidence: 1 })], 5), mk(1, "2026-10-01", [m(1, { confidence: 5 })], 5)]);
    expect(e.sections[0].lastConfidence?.value).toBe(1);
    expect(e.lowConfidence).toEqual(["A"]);
  });

  it("keeps missing figures out of verified maxima and has no denominator for a whole piece", () => {
    const e = pieceEvidence({}, [], [mk(1, "2026-10-01", [m(undefined, { bpm: 120, noteVal: "eighth" })]), mk(2, "2026-10-02", [m(undefined, { bpm: 70 })])]);
    expect(e.total).toBe(0);
    expect(e.toDo).toEqual([]);
    expect(e.best).toEqual([{ bpm: 120, noteVal: "eighth", date: "2026-10-01" }]);
    expect(e.sections[0].lastTempo).toMatchObject({ bpm: 70 });
  });
});
