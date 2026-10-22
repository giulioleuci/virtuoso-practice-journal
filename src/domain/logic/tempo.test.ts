import { describe, expect, it } from "vitest";
import { NOTE_VALUES } from "../constants/noteValues";
import { compareTempos, convertTempo, normalizedTempo, stepTempo } from "./tempo";

describe("musical tempos", () => {
  it("uses exact weights and converts without rounding or mutating", () => {
    expect(NOTE_VALUES.map(noteVal => normalizedTempo({ bpm: 1, noteVal }))).toEqual([16, 8, 4, 2, 1, 12, 6, 3]);
    const tempo = { bpm: 50, noteVal: "quarter" as const };
    expect(normalizedTempo(tempo)).toBe(200);
    for (const [a, b] of [[tempo, { bpm: 100, noteVal: "eighth" }], [{ bpm: 30, noteVal: "eighth" }, { bpm: 10, noteVal: "dotted-quarter" }], [{ bpm: 30, noteVal: "dotted-quarter" }, { bpm: 90, noteVal: "eighth" }]] as const) expect(compareTempos(a, b)).toBe(0);
    expect(convertTempo(tempo, "dotted-quarter")).toBeCloseTo(100 / 3);
    for (const noteVal of NOTE_VALUES) expect(convertTempo({ bpm: convertTempo(tempo, noteVal), noteVal }, "quarter")).toBeCloseTo(50);
    expect(tempo).toEqual({ bpm: 50, noteVal: "quarter" });
  });
  it("preserves fixed steps exactly and rounds percentages once", () => {
    expect(stepTempo({ bpm: 50, noteVal: "quarter" }, { kind: "fixed", value: 1, noteVal: "eighth" }, "increase")).toEqual({ bpm: 101, noteVal: "eighth" });
    expect(stepTempo({ bpm: 70, noteVal: "quarter" }, { kind: "percent", value: 3 }, "increase")).toEqual({ bpm: 72, noteVal: "quarter" });
    expect(stepTempo({ bpm: 70, noteVal: "quarter" }, { kind: "percent", value: 0.1 }, "increase")).toEqual({ bpm: 71, noteVal: "quarter" });
    expect(stepTempo({ bpm: 70, noteVal: "quarter" }, { kind: "percent", value: 5 }, "decrease")).toEqual({ bpm: 67, noteVal: "quarter" });
    expect(stepTempo({ bpm: 1, noteVal: "quarter" }, { kind: "percent", value: 5 }, "decrease")).toBeUndefined();
    expect(stepTempo({ bpm: 400, noteVal: "whole" }, { kind: "fixed", value: 1, noteVal: "whole" }, "increase")).toBeUndefined();
    expect(stepTempo({ bpm: 400, noteVal: "quarter" }, { kind: "percent", value: 100 }, "increase")).toEqual({ bpm: 200, noteVal: "whole" });
  });
});
