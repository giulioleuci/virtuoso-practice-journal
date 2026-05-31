import { describe, it, expect } from "vitest";
import {
  poolEntryKey,
  confidenceToWeight,
  uniformSampleWithoutReplacement,
  weightedSampleWithoutReplacement,
  generateRoutineTasks,
  type ResolvedPoolItem,
} from "@/lib/domain/studyRoutineGenerator";
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
  it("emits one task on the matrix day within the horizon", () => {
    const groupItems = new Map([["g1", [item(1, "Sonata")]]]);
    const tasks = generateRoutineTasks(routine({}), groupItems, null, "2026-05-18", 100);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].date).toBe("2026-05-18");
    expect(tasks[0].itemId).toBe(1);
    expect(tasks[0].studyRoutineId).toBe(7);
    expect(tasks[0].createdAt).toBe(100);
  });

  it("respects repetitionCap per week", () => {
    const groupItems = new Map([["g1", [item(1)]]]);
    const r = routine({ matrix: { "1": { g1: 1 }, "3": { g1: 1 } }, repetitionCap: 1, weeksAhead: 2 });
    const tasks = generateRoutineTasks(r, groupItems, null, "2026-05-18", 0);
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
    const tasks = generateRoutineTasks(r, groupItems, null, "2026-05-18", 0);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].itemId).toBe(42);
    expect(tasks[0].segmentIds?.sort()).toEqual([1, 2]);
  });
});
