/**
 * Tests for studyRoutinesService.
 *
 * System time is faked to 2026-05-18 (Monday) so that todayStr() and
 * date-range logic are deterministic regardless of when the tests run.
 *
 * Routines use useSpacedRepetition: false to eliminate Math.random() from
 * sampling (uniformSampleWithoutReplacement returns all items when
 * count >= pool.length, which is enforced by test setup).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { studyRoutinesService } from "@/lib/services/studyRoutines";
import { planSegmentIds } from "@/domain/logic/plan";
import type { StudyRoutineConfig } from "@/lib/schemas";

// Monday 2026-05-18 12:00 UTC
const FAKE_NOW = new Date("2026-05-18T12:00:00.000Z");
const TODAY = "2026-05-18";

beforeEach(async () => {
  // Only fake Date, not timers — fake-indexeddb relies on real timers internally
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FAKE_NOW);
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedSubject(): Promise<number> {
  return (await db.subjects.add({
    name: "Piano",
    type: "instrument" as const,
    createdAt: Date.now(),
  })) as number;
}

async function seedItem(subjectId: number, title = "Sonata"): Promise<number> {
  return (await db.library.add({
    subjectId,
    kind: "repertoire" as const,
    title,
    createdAt: Date.now(),
  })) as number;
}

async function seedSegment(itemId: number, label = "Exposition"): Promise<number> {
  return (await db.segments.add({
    itemId,
    label,
    layers: [],
    createdAt: Date.now(),
  })) as number;
}

async function seedCollection(subjectId: number, name = "Studies"): Promise<number> {
  return (await db.collections.add({
    kind: "repertoire" as const,
    name,
    defaultSubjectId: subjectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })) as number;
}

/** Build a minimal StudyRoutineConfig with sensible defaults. */
function makeConfig(
  subjectId: number,
  pool: StudyRoutineConfig["groups"][0]["pool"],
  overrides: Partial<StudyRoutineConfig> = {},
): StudyRoutineConfig {
  return {
    name: "Routine",
    subjectId,
    groups: [{ id: "g1", name: "Group", pool }],
    // Monday (day 1): pick 1 item from g1
    matrix: { "1": { g1: 1 } },
    weeksAhead: 2,
    repetitionCap: 2,
    useSpacedRepetition: false,
    startDate: TODAY,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// create — task generation
// ---------------------------------------------------------------------------

describe("studyRoutinesService.create — task generation", () => {
  it("creates the routine record and returns its id", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }]),
    );
    const routine = await db.studyRoutines.get(routineId);
    expect(routine).toBeDefined();
    expect(routine!.subjectId).toBe(subjectId);
  });

  it("generates tasks tagged with studyRoutineId", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }]),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.studyRoutineId).toBe(routineId);
      expect(t.done).toBe(false);
      expect(t.subjectId).toBe(subjectId);
    }
  });

  it("only generates tasks on days specified in the matrix", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // Monday-only matrix, startDate = Monday
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 } }, // Only Monday
        weeksAhead: 1,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // 1 week from 2026-05-18: covers May 18 (Mon) to May 24 (Sun). Only Monday = May 18.
    expect(tasks).toHaveLength(1);
    expect(tasks[0].date).toBe("2026-05-18");
    expect(tasks[0].itemId).toBe(itemId);
  });

  it("generates the correct number of tasks across multiple weeks", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // Monday + Wednesday (days 1, 3), weeksAhead = 2
    // 2026-05-18 Mon, 2026-05-20 Wed, 2026-05-25 Mon, 2026-05-27 Wed
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 }, "3": { g1: 1 } },
        weeksAhead: 2,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks).toHaveLength(4);
    const dates = tasks.map((t) => t.date).sort();
    expect(dates).toEqual(["2026-05-18", "2026-05-20", "2026-05-25", "2026-05-27"]);
  });

  it("does not generate tasks beyond startDate + weeksAhead * 7 days", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        // Every day
        matrix: {
          "0": { g1: 1 }, "1": { g1: 1 }, "2": { g1: 1 },
          "3": { g1: 1 }, "4": { g1: 1 }, "5": { g1: 1 }, "6": { g1: 1 },
        },
        weeksAhead: 1,
        // cap high enough that the item can appear every day
        repetitionCap: 7,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // 1 week = 7 days: May 18 (Mon) through May 24 (Sun)
    expect(tasks).toHaveLength(7);
    const dates = tasks.map((t) => t.date).sort();
    expect(dates[0]).toBe("2026-05-18");
    expect(dates[6]).toBe("2026-05-24");
  });

  it("respects repetitionCap — item does not appear more than cap times per week", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // Monday + Wednesday + Friday, cap = 1 → item can appear at most once per week
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 }, "3": { g1: 1 }, "5": { g1: 1 } },
        repetitionCap: 1,
        weeksAhead: 2,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // cap=1 → only 1 task per week; 2 weeks → 2 tasks total
    expect(tasks).toHaveLength(2);
    // Each week's task should be the only one for that week
    const week1Tasks = tasks.filter((t) => t.date >= "2026-05-18" && t.date <= "2026-05-24");
    const week2Tasks = tasks.filter((t) => t.date >= "2026-05-25" && t.date <= "2026-05-31");
    expect(week1Tasks).toHaveLength(1);
    expect(week2Tasks).toHaveLength(1);
  });

  it("cap resets each week — item can appear up to cap times in each new week", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // Mon + Wed, cap = 2 → item can appear twice per week (fills both days)
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 }, "3": { g1: 1 } },
        repetitionCap: 2,
        weeksAhead: 2,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // cap=2, 2 days per week, 2 weeks → all 4 slots filled
    expect(tasks).toHaveLength(4);
  });

  it("sets task title and itemId from library for item pool entries", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId, "Moonlight Sonata");
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], { weeksAhead: 1 }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks[0].itemId).toBe(itemId);
    expect(tasks[0].title).toBe("Moonlight Sonata");
    expect(tasks[0].linkType).toBe("item");
  });

  it("generates no tasks when pool items are missing from the database", async () => {
    const subjectId = await seedSubject();
    // itemId 9999 does not exist in the DB
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: 9999 }]),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks).toHaveLength(0);
  });

  it("generates no tasks when matrix is empty", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], { matrix: {} }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks).toHaveLength(0);
  });

  it("handles segment pool entries — merges multiple segments from same item into one task", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId, "Concerto");
    const seg1 = await seedSegment(itemId, "Movement 1");
    const seg2 = await seedSegment(itemId, "Movement 2");
    // Both segments in same group, count=2 → both selected, merged into one task
    const routineId = await studyRoutinesService.create({
      ...makeConfig(subjectId, [
        { type: "segment", id: seg1 },
        { type: "segment", id: seg2 },
      ]),
      matrix: { "1": { g1: 2 } }, // request 2 items on Monday
      weeksAhead: 1,
    });
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // Two segments from the same parent → merged into one task
    expect(tasks).toHaveLength(1);
    expect(tasks[0].itemId).toBe(itemId);
    expect(planSegmentIds(tasks[0].plan).sort()).toEqual([seg1, seg2].sort());
  });

  it("handles collection pool entries", async () => {
    const subjectId = await seedSubject();
    const colId = await seedCollection(subjectId, "Études");
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "collection", id: colId }], { weeksAhead: 1 }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].collectionId).toBe(colId);
    expect(tasks[0].linkType).toBe("collection");
    expect(tasks[0].title).toBe("Études");
  });

  it("handles multiple groups in the matrix independently", async () => {
    const subjectId = await seedSubject();
    const item1 = await seedItem(subjectId, "Piece A");
    const item2 = await seedItem(subjectId, "Piece B");
    const routineId = await studyRoutinesService.create({
      name: "Routine",
      subjectId,
      groups: [
        { id: "g1", name: "Group 1", pool: [{ type: "item", id: item1 }] },
        { id: "g2", name: "Group 2", pool: [{ type: "item", id: item2 }] },
      ],
      // Monday: 1 from g1 AND 1 from g2
      matrix: { "1": { g1: 1, g2: 1 } },
      weeksAhead: 1,
      repetitionCap: 2,
      useSpacedRepetition: false,
      startDate: TODAY,
    });
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // 1 week, 1 Monday → 2 tasks (one per group)
    expect(tasks).toHaveLength(2);
    const itemIds = tasks.map((t) => t.itemId).sort();
    expect(itemIds).toEqual([item1, item2].sort());
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("studyRoutinesService.remove", () => {
  it("hard-deletes future undone tasks", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // startDate = TODAY → tasks in the future (today onwards)
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 }, "3": { g1: 1 } },
        weeksAhead: 2,
      }),
    );
    const before = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(before.length).toBeGreaterThan(0);

    await studyRoutinesService.remove(routineId);

    const after = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(after).toHaveLength(0);
  });

  it("preserves tasks that are already marked done", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], { weeksAhead: 1 }),
    );
    const [task] = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    await db.tasks.update(task.id!, { done: true });

    await studyRoutinesService.remove(routineId);

    const remaining = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].done).toBe(true);
  });

  it("preserves past undone tasks (date before today)", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }]),
    );
    // Manually insert a task with a past date for this routine
    const pastId = (await db.tasks.add({
      studyRoutineId: routineId,
      subjectId,
      date: "2026-05-11", // last Monday — before today
      title: "Past task",
      plan: [],
      done: false,
      createdAt: Date.now(),
    })) as number;

    await studyRoutinesService.remove(routineId);

    // Past undone task is kept (date < today)
    expect(await db.tasks.get(pastId)).toBeDefined();
  });

  it("soft-deletes the routine record itself", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }]),
    );
    await studyRoutinesService.remove(routineId);
    const routine = await db.studyRoutines.get(routineId);
    expect(routine).toBeDefined();
    expect(routine!.deletedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// regenerateFromDate
// ---------------------------------------------------------------------------

describe("studyRoutinesService.regenerateFromDate", () => {
  it("deletes future undone tasks from the given date and regenerates them", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const config = makeConfig(subjectId, [{ type: "item", id: itemId }], {
      matrix: { "1": { g1: 1 } }, // Monday only
      weeksAhead: 2,
    });
    const routineId = await studyRoutinesService.create(config);
    const routine = await db.studyRoutines.get(routineId);

    const originalTasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    const originalIds = new Set(originalTasks.map((t) => t.id!));

    await studyRoutinesService.regenerateFromDate(routine!, TODAY);

    const newTasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // Old tasks should be gone; new tasks should exist
    const newIds = new Set(newTasks.map((t) => t.id!));
    // None of the original IDs should survive (all were undone and >= today)
    for (const id of originalIds) {
      expect(newIds.has(id)).toBe(false);
    }
    expect(newTasks.length).toBeGreaterThan(0);
  });

  it("preserves done tasks when regenerating", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], { weeksAhead: 1 }),
    );
    const routine = await db.studyRoutines.get(routineId);
    const [task] = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    await db.tasks.update(task.id!, { done: true });

    await studyRoutinesService.regenerateFromDate(routine!, TODAY);

    const doneTask = await db.tasks.get(task.id!);
    expect(doneTask).toBeDefined();
    expect(doneTask!.done).toBe(true);
  });

  it("seed counters from done tasks reduce available cap in the same week", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // cap=1, Mon+Wed+Fri; item can appear only once per week
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 }, "3": { g1: 1 }, "5": { g1: 1 } },
        repetitionCap: 1,
        weeksAhead: 2,
      }),
    );
    const routine = await db.studyRoutines.get(routineId);
    const beforeTasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // With cap=1: 1 task per week × 2 weeks = 2 tasks total
    expect(beforeTasks).toHaveLength(2);

    // Mark Monday's task (week 1) as done
    const week1Task = beforeTasks.find((t) => t.date === "2026-05-18")!;
    await db.tasks.update(week1Task.id!, { done: true });

    // Regenerate from Wednesday (same week as the done Monday task)
    // Seed counter sees Monday's done task → item already at cap=1 for week 1
    // So no new tasks are generated for Wed/Fri of week 1
    await studyRoutinesService.regenerateFromDate(routine!, "2026-05-20"); // Wednesday

    const afterTasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    const week1Undone = afterTasks.filter((t) => !t.done && t.date >= "2026-05-18" && t.date <= "2026-05-24");
    // Item already hit cap=1 for week 1 → no new undone tasks in week 1 (Wed/Fri slots blocked)
    expect(week1Undone).toHaveLength(0);
    // Subsequent weeks regenerate normally: cap resets per week, so 1 Monday task per week
    // generate runs for weeksAhead * 7 = 14 days from fromDate (May 20), covering weeks 2 and 3
    const laterUndone = afterTasks.filter((t) => !t.done && t.date >= "2026-05-25");
    expect(laterUndone.length).toBeGreaterThan(0);
  });

  it("undone tasks before fromDate are preserved untouched", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 1 } }, // Monday only
        weeksAhead: 2,
      }),
    );
    const routine = await db.studyRoutines.get(routineId);

    // Before: week 1 (May 18) and week 2 (May 25) tasks exist
    const before = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(before.map((t) => t.date).sort()).toEqual(["2026-05-18", "2026-05-25"]);
    const week1Id = before.find((t) => t.date === "2026-05-18")!.id!;

    // Regenerate from week 2 start (May 25) — only affects May 25+ tasks
    await studyRoutinesService.regenerateFromDate(routine!, "2026-05-25");

    // Week 1 task (May 18) is before fromDate → not deleted, still present
    const week1Task = await db.tasks.get(week1Id);
    expect(week1Task).toBeDefined();
    expect(week1Task!.date).toBe("2026-05-18");

    // Week 2 tasks are regenerated (old May 25 task replaced by new one)
    const after = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    const afterDates = after.filter((t) => !t.done).map((t) => t.date).sort();
    expect(afterDates).toContain("2026-05-18"); // week 1 preserved
    expect(afterDates).toContain("2026-05-25"); // week 2 regenerated
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("studyRoutinesService.update", () => {
  it("persists the patch to the routine record", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }]),
    );
    await studyRoutinesService.update(routineId, { weeksAhead: 4 });
    const routine = await db.studyRoutines.get(routineId);
    expect(routine!.weeksAhead).toBe(4);
  });

  it("regenerates tasks from today after an update", async () => {
    const subjectId = await seedSubject();
    const item1 = await seedItem(subjectId, "Original");
    const item2 = await seedItem(subjectId, "Added");
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: item1 }], {
        matrix: { "1": { g1: 1 } },
        weeksAhead: 1,
      }),
    );
    const before = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(before.every((t) => t.itemId === item1)).toBe(true);

    // Update the pool to use item2 instead
    const routine = await db.studyRoutines.get(routineId);
    await studyRoutinesService.update(routineId, {
      groups: [{ id: "g1", name: "Group", pool: [{ type: "item", id: item2 }] }],
    });

    const after = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    const undone = after.filter((t) => !t.done);
    expect(undone.every((t) => t.itemId === item2)).toBe(true);
  });

  it("returns early without crashing when routine does not exist", async () => {
    await expect(studyRoutinesService.update(9999, { weeksAhead: 3 })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("studyRoutinesService — edge cases", () => {
  it("multiple routines for the same subject generate independent tasks", async () => {
    const subjectId = await seedSubject();
    const item1 = await seedItem(subjectId, "A");
    const item2 = await seedItem(subjectId, "B");
    const r1 = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: item1 }], { weeksAhead: 1 }),
    );
    const r2 = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: item2 }], { weeksAhead: 1 }),
    );
    const t1 = await db.tasks.where("studyRoutineId").equals(r1).toArray();
    const t2 = await db.tasks.where("studyRoutineId").equals(r2).toArray();
    expect(t1.every((t) => t.itemId === item1)).toBe(true);
    expect(t2.every((t) => t.itemId === item2)).toBe(true);
    // Tasks from the two routines don't overlap
    const ids1 = new Set(t1.map((t) => t.id!));
    const ids2 = new Set(t2.map((t) => t.id!));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);
  });

  it("count = 0 for a group in the matrix generates no tasks for that group", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 0 } }, // zero count
        weeksAhead: 1,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    expect(tasks).toHaveLength(0);
  });

  it("requesting more items than pool size clamps to pool size", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // Only 1 item in pool but count=5 requested
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [{ type: "item", id: itemId }], {
        matrix: { "1": { g1: 5 } },
        repetitionCap: 5,
        weeksAhead: 1,
      }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // Only 1 unique item → only 1 task per day
    expect(tasks).toHaveLength(1);
  });

  it("duplicate pool entries are deduplicated during resolution", async () => {
    const subjectId = await seedSubject();
    const itemId = await seedItem(subjectId);
    // Same item appears twice in the pool
    const routineId = await studyRoutinesService.create(
      makeConfig(subjectId, [
        { type: "item", id: itemId },
        { type: "item", id: itemId },
      ], { weeksAhead: 1 }),
    );
    const tasks = await db.tasks.where("studyRoutineId").equals(routineId).toArray();
    // After dedup, only 1 unique item → 1 task on Monday
    expect(tasks).toHaveLength(1);
  });
});
