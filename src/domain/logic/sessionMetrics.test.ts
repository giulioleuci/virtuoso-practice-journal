import { describe, expect, it } from "vitest";
import { topBpm, topMark } from "./sessionMetrics";
import { sessionLabel } from "@/lib/format";

describe("tempo summaries", () => {
  it("compares musical velocity and keeps original figures visible", () => {
    const marks = [
      { bpm: 88, noteVal: "quarter" as const, layers: [], techniques: [] },
      { bpm: 56, noteVal: "eighth" as const, layers: [], techniques: [] },
    ];
    expect(topBpm(marks)).toBe(88);
    expect(topMark([marks[0], { ...marks[1], bpm: 150 }])).toBe(marks[0]);
    expect(topBpm([{ bpm: 400, layers: [],techniques: [] }])).toBeUndefined();
    expect(sessionLabel(marks)).toBe("\u{1D15F} = 88 · \u{1D160} = 56");
    expect(topBpm([marks[0], { ...marks[0], bpm: 96 }])).toBe(96);
  });
});
