import { describe, it, expect } from "vitest";
import {
  poolEntryKey,
  confidenceToWeight,
  uniformSampleWithoutReplacement,
  weightedSampleWithoutReplacement,
  generateRoutineTasks,
  decayedAverage,
  adaptiveWeight,
  mulberry32,
  collectRoutineWarnings,
  type ResolvedPoolItem,
} from "@/lib/domain/studyRoutineGenerator";
import { planSegmentIds } from "@/domain/logic/plan";
import type { StudyRoutine } from "@/lib/db";

const item = (id: number, title = `i${id}`): ResolvedPoolItem => ({
  key: `item:${id}`,
  type: "item",
  title,
  itemId: id,
  linkType: "item",
});

describe("poolEntryKey", () => {
  it("encodes type and id", () => {
    expect(poolEntryKey({ type: "item", id: 5 })).toBe("item:5");
    expect(poolEntryKey({ type: "segment", id: 9 })).toBe("segment:9");
  });
});

describe("confidenceToWeight", () => {
  it("maps low confidence to high weight and vice versa", () => {
    expect(confidenceToWeight(null)).toBe(3);
    expect(confidenceToWeight(1)).toBe(5);
    expect(confidenceToWeight(2)).toBe(4);
    expect(confidenceToWeight(3)).toBe(3);
    expect(confidenceToWeight(4)).toBe(2);
    expect(confidenceToWeight(5)).toBe(1);
  });
});

describe("sampling", () => {
  it("uniform returns all items when count >= length", () => {
    const items = [item(1), item(2)];
    expect(uniformSampleWithoutReplacement(items, 5)).toHaveLength(2);
  });
  it("weighted returns all items when count >= length", () => {
    const items = [item(1), item(2)];
    expect(weightedSampleWithoutReplacement(items, 5, new Map())).toHaveLength(2);
  });
  it("weighted respects exact count", () => {
    const items = [item(1), item(2), item(3)];
    expect(weightedSampleWithoutReplacement(items, 2, new Map())).toHaveLength(2);
  });
});

const routine = (over: Partial<StudyRoutine>): StudyRoutine => ({
  subjectId: 1,
  groups: [{ id: "g1", name: "G", pool: [{ type: "item", id: 1 }] }],
  matrix: { "1": { g1: 1 } }, // Monday
  weeksAhead: 1,
  repetitionCap: 2,
  useSpacedRepetition: false,
  startDate: "2026-05-18",
  createdAt: 0,
  id: 7,
  ...over,
});

describe("generateRoutineTasks", () => {
  it("follows configured group order instead of matrix order", () => {
    const r = routine({
      groups: [
        { id: "scales", name: "Scale", pool: [{ type: "item", id: 2 }, { type: "item", id: 1 }] },
        { id: "arpeggios", name: "Arpeggi", pool: [{ type: "item", id: 3 }] },
      ],
      matrix: { "1": { arpeggios: 1, scales: 1 }, "2": { arpeggios: 1, scales: 2 } },
    });
    const tasks = generateRoutineTasks({ routine: r, groupItems: new Map([
      ["scales", [item(2), item(1)]], ["arpeggios", [item(3)]],
    ]), stats: null, fromDate: "2026-05-18", createdAt: 0, rng: () => 0 });
    expect(tasks.filter(t => t.date === "2026-05-18").map(t => t.itemId)).toEqual([1, 3]);
    expect(tasks.filter(t => t.date === "2026-05-19").map(t => t.itemId)).toEqual([2, 1, 3]);
  });

  it("emits one task on the matrix day within the horizon", () => {
    const groupItems = new Map([["g1", [item(1, "Sonata")]]]);
    const tasks = generateRoutineTasks({ routine: routine({}), groupItems, stats: null, fromDate: "2026-05-18", createdAt: 100 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].date).toBe("2026-05-18");
    expect(tasks[0].itemId).toBe(1);
    expect(tasks[0].studyRoutineId).toBe(7);
    expect(tasks[0].createdAt).toBe(100);
  });

  it("respects repetitionCap per week", () => {
    const groupItems = new Map([["g1", [item(1)]]]);
    const r = routine({ matrix: { "1": { g1: 1 }, "3": { g1: 1 } }, repetitionCap: 1, weeksAhead: 2 });
    const tasks = generateRoutineTasks({ routine: r, groupItems, stats: null, fromDate: "2026-05-18", createdAt: 0 });
    // cap=1 → at most 1 per week × 2 weeks
    expect(tasks).toHaveLength(2);
  });

  it("merges segments of the same parent into one task", () => {
    const seg = (id: number): ResolvedPoolItem => ({
      key: `segment:${id}`, type: "segment", title: `P — s${id}`, parentTitle: "P",
      itemId: 42, segmentIds: [id], linkType: "item",
    });
    const groupItems = new Map([["g1", [seg(1), seg(2)]]]);
    const r = routine({ matrix: { "1": { g1: 2 } } });
    const tasks = generateRoutineTasks({ routine: r, groupItems, stats: null, fromDate: "2026-05-18", createdAt: 0 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].itemId).toBe(42);
    expect(planSegmentIds(tasks[0].plan).sort()).toEqual([1, 2]);
  });
});

describe("whole item asked for more entries than the pool holds", () => {
  it("draws that many sections into one task", () => {
    const seg = (id: number): ResolvedPoolItem => ({
      key: `segment:${id}`, type: "segment", title: `P — s${id}`, parentTitle: "P",
      itemId: 42, segmentIds: [id], linkType: "item",
    });
    const whole: ResolvedPoolItem = { key: "item:42", type: "item", title: "P", itemId: 42, linkType: "item", sections: [seg(1), seg(2), seg(3), seg(4)] };
    const r = routine({ matrix: { "1": { g1: 3 } } });
    const tasks = generateRoutineTasks({ routine: r, groupItems: new Map([["g1", [whole]]]), stats: null, fromDate: "2026-05-18", createdAt: 0 });
    expect(tasks).toHaveLength(1);
    expect(planSegmentIds(tasks[0].plan)).toHaveLength(3);
  });
});

describe("adaptive weighting", () => {
  it("weights recent ratings more than older ones", () => {
    // Newest-first: the latest rating pulls the average towards itself.
    expect(decayedAverage([1, 5, 5])!).toBeLessThan((1 + 5 + 5) / 3);
    expect(decayedAverage([5, 1, 1])!).toBeGreaterThan((5 + 1 + 1) / 3);
    expect(decayedAverage([])).toBeNull();
  });

  it("gives entries without history a high weight", () => {
    const fresh = adaptiveWeight(undefined, "balanced", "2026-05-18");
    const solid = adaptiveWeight({ confidence: 5, lastPracticed: "2026-05-18", sessions: 4 }, "balanced", "2026-05-18");
    expect(fresh).toBeGreaterThan(solid);
  });

  it("raises the weight of entries untouched for a long time", () => {
    const stale = adaptiveWeight({ confidence: 4, lastPracticed: "2026-04-01", sessions: 3 }, "balanced", "2026-05-18");
    const fresh = adaptiveWeight({ confidence: 4, lastPracticed: "2026-05-18", sessions: 3 }, "balanced", "2026-05-18");
    expect(stale).toBeGreaterThan(fresh);
  });

  it("flattens every weight in uniform mode", () => {
    expect(adaptiveWeight({ confidence: 1, sessions: 2 }, "uniform", "2026-05-18")).toBe(1);
  });

  it("amplifies differences in aggressive mode", () => {
    const weak = { confidence: 1, lastPracticed: "2026-05-18", sessions: 2 };
    const strong = { confidence: 5, lastPracticed: "2026-05-18", sessions: 2 };
    const balancedRatio = adaptiveWeight(weak, "balanced", "2026-05-18") / adaptiveWeight(strong, "balanced", "2026-05-18");
    const aggressiveRatio = adaptiveWeight(weak, "aggressive", "2026-05-18") / adaptiveWeight(strong, "aggressive", "2026-05-18");
    expect(aggressiveRatio).toBeGreaterThan(balancedRatio);
  });
});

describe("deterministic preview", () => {
  it("produces the same draw for the same seed", () => {
    const groupItems = new Map([["g1", [item(1), item(2), item(3), item(4)]]]);
    const r = routine({ groups: [{ id: "g1", name: "G", pool: [{ type: "item", id: 1 }] }], matrix: { "1": { g1: 2 } }, adaptivity: "balanced" });
    const run = () => generateRoutineTasks({ routine: r, groupItems, stats: null, fromDate: "2026-05-18", createdAt: 0, rng: mulberry32(42) }).map((t) => t.itemId);
    expect(run()).toEqual(run());
  });
});

describe("per-group caps and back-to-back avoidance", () => {
  it("uses the group cap over the routine cap", () => {
    const groupItems = new Map([["g1", [item(1)]]]);
    const r = routine({
      groups: [{ id: "g1", name: "G", pool: [{ type: "item", id: 1 }], repetitionCap: 1 }],
      matrix: { "1": { g1: 1 }, "3": { g1: 1 } },
      repetitionCap: 5,
    });
    expect(generateRoutineTasks({ routine: r, groupItems, stats: null, fromDate: "2026-05-18", createdAt: 0 })).toHaveLength(1);
  });

  it("prefers an entry not drawn the previous day", () => {
    const groupItems = new Map([["g1", [item(1), item(2)]]]);
    const r = routine({ matrix: { "1": { g1: 1 }, "2": { g1: 1 } }, repetitionCap: 5, avoidBackToBack: true });
    const tasks = generateRoutineTasks({ routine: r, groupItems, stats: null, fromDate: "2026-05-18", createdAt: 0 });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].itemId).not.toBe(tasks[1].itemId);
  });
});

describe("combined groups", () => {
  const seg = (itemId: number, id: number): ResolvedPoolItem => ({ key: `segment:${id}`, type: "segment", title: `i${itemId}`, itemId, segmentIds: [id], plan: [{ segmentId: id, layers: [], techniques: [] }], linkType: "item" });
  const run = (combine: boolean) => generateRoutineTasks({
    routine: routine({ groups: [{ id: "g1", name: "Scale", pool: [], combine }], matrix: { "1": { g1: 4 } } }),
    groupItems: new Map([["g1", [seg(1, 10), seg(1, 11), seg(2, 20), seg(2, 21)]]]),
    stats: null, fromDate: "2026-05-18", createdAt: 0,
  });
  it("folds sections of several items into one free task", () => {
    const tasks = run(true);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: "Scale", linkType: "free", itemId: undefined });
    expect(planSegmentIds(tasks[0].plan).sort()).toEqual([10, 11, 20, 21]);
  });
  it("keeps one task per item when off", () => expect(run(false)).toHaveLength(2));
});

describe("collectRoutineWarnings", () => {
  it("flags a day asking for more than the pool holds", () => {
    const warnings = collectRoutineWarnings({
      groups: [{ id: "g1", name: "Scale", pool: [{ type: "item", id: 1 }] }],
      matrix: { "1": { g1: 3 } },
      repetitionCap: 5,
    });
    expect(warnings.some((w) => w.kind === "dayExceedsPool")).toBe(true);
  });

  it("flags a cap too low for the weekly demand", () => {
    const warnings = collectRoutineWarnings({
      groups: [{ id: "g1", name: "Scale", pool: [{ type: "item", id: 1 }] }],
      matrix: { "1": { g1: 1 }, "2": { g1: 1 }, "3": { g1: 1 } },
      repetitionCap: 1,
    });
    expect(warnings.some((w) => w.kind === "capTooLow")).toBe(true);
  });
});
