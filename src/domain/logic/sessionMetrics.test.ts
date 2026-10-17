import { describe, expect, it } from "vitest";
import { topBpm } from "./sessionMetrics";
import { sessionLabel } from "@/lib/format";

describe("tempo summaries", () => {
  it("compares only matching figures and keeps distinct figures visible", () => {
    const marks = [
      { bpm: 88, noteVal: "quarter" as const, layers: [], techniques: [] },
      { bpm: 56, noteVal: "eighth" as const, layers: [], techniques: [] },
    ];
    expect(topBpm(marks)).toBeUndefined();
    expect(sessionLabel(marks)).toBe("♩ = 88 · ♪ = 56");
    expect(topBpm([marks[0], { ...marks[0], bpm: 96 }])).toBe(96);
  });
});
