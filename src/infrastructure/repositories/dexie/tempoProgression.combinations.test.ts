import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { tempoProgressionRepository as repository } from "./tempoProgressionRepository";
import { sessionRepository } from "./sessionRepository";
import { TempoProgressionUseCase } from "@/application/useCases/tempoProgression";
import { inheritTempoProgressions, tempoContextKey } from "@/domain/logic/tempoProgression";
import type { SegmentEntry, SegmentMark } from "@/domain/entities/common";
import type { Task } from "@/domain/entities/task";
import type { TempoContext, TempoOwner, TempoProgressionRule } from "@/domain/entities/tempoProgression";

const routine: TempoOwner = { kind: "routine", id: 1 };
const rule: TempoProgressionRule = { enabled: true, successes: 3, minConfidence: 4, increase: { kind: "fixed", value: 2, noteVal: "quarter" }, decrease: { failures: 2, step: { kind: "percent", value: 5 } } };
const at = new Date(2026, 9, 22, 12).getTime();
const useCase = new TempoProgressionUseCase(repository, () => at);
const ctx = (itemId: number, segmentId?: number, layers: string[] = [], techniques: number[] = []): TempoContext => ({ itemId, segmentId, layers, techniques });
const entry = (segmentId?: number, bpm = 70, extra: Partial<SegmentEntry> = {}): SegmentEntry => ({ segmentId, bpm, noteVal: "quarter", layers: [], techniques: [], ...extra });
let nextTask = 1;
const addTask = (patch: Partial<Task>) => db.tasks.add({ id: nextTask++, title: "T", subjectId: 1, date: "2026-10-23", plan: [entry()], done: false, createdAt: 1, studyRoutineId: 1, ...patch } as Task) as Promise<number>;
const planOf = async (id: number) => (await db.tasks.get(id))!.plan;
const bpms = async (id: number) => (await planOf(id)).map(e => e.bpm);
const start = async (context: TempoContext, bpm = 70, owner = routine, sourceTaskId?: number) => {
  const preview = (await useCase.preview({ owner, context, initialTempo: { bpm, noteVal: "quarter" }, sourceTaskId }))!;
  const result = await useCase.accept(preview);
  if (result.status !== "applied") throw new Error("not applied");
  return result.state;
};
/** One logged session: each mark meets the target stored in its plan entry, unless overridden. */
const study = async (taskId: number, date: string, marks: Array<Partial<SegmentMark>>) => {
  const task = (await db.tasks.get(taskId))!;
  const full = marks.map(m => { const e = task.plan.find(p => p.segmentId === m.segmentId) ?? task.plan[0]; return { ...e, targetBpm: e.bpm, targetNoteVal: e.noteVal, confidence: 5, ...m } as SegmentMark; });
  return sessionRepository.log(task, date, { marks: full } as never);
};
const suggestion = async (context: TempoContext, owner = routine) => (await useCase.view(owner, context)).evaluation?.suggestion;

beforeEach(async () => {
  nextTask = 1;
  await db.delete(); await db.open();
  await db.subjects.add({ id: 1, name: "Piano", type: "instrument", createdAt: 1 });
  await db.library.bulkAdd([1, 2, 3].map(id => ({ id, subjectId: 1, kind: "piece" as const, title: `Piece ${id}`, createdAt: 1 })));
  await db.segments.bulkAdd([
    { id: 1, itemId: 1, label: "A", position: 0, layers: [], createdAt: 1 }, { id: 2, itemId: 1, label: "B", position: 1, layers: [], createdAt: 1 }, { id: 3, itemId: 1, label: "C", position: 2, layers: [], createdAt: 1 },
    { id: 4, itemId: 2, label: "D", position: 0, layers: [], createdAt: 1 }, { id: 5, itemId: 2, label: "E", position: 1, layers: [], createdAt: 1 },
  ]);
  await db.studyRoutines.bulkAdd([1, 2].map(id => ({ id, subjectId: 1, groups: [], matrix: {}, weeksAhead: 1, repetitionCap: 1, startDate: "2026-10-22", createdAt: 1 })));
  await repository.configure(routine, rule, at);
  await repository.configure({ kind: "routine", id: 2 }, rule, at);
});

describe("sections and subtasks of one piece", () => {
  it("moves only the matching section, in every compatible task", async () => {
    const ids = [await addTask({ itemId: 1, plan: [entry(1), entry(2), entry(3)] }), await addTask({ itemId: 1, date: "2026-10-24", plan: [entry(1), entry(2), entry(3)] }), await addTask({ itemId: 1, date: "2026-10-25", plan: [entry(2)] })];
    await start(ctx(1, 2), 75);
    expect(await bpms(ids[0])).toEqual([70, 75, 70]);
    expect(await bpms(ids[1])).toEqual([70, 75, 70]);
    expect(await bpms(ids[2])).toEqual([75]);
    expect((await planOf(ids[0]))[0].progression).toBeUndefined();
  });

  it("keeps sections, layers and techniques as separate contexts", async () => {
    const id = await addTask({ itemId: 1, plan: [entry(undefined, 70, { layers: ["RH"] }), entry(undefined, 70, { layers: ["LH"] }), entry(undefined, 70, { layers: ["RH"], techniques: [4] }), entry(undefined, 70)] });
    await start(ctx(1, undefined, ["RH"]), 80);
    expect(await bpms(id)).toEqual([80, 70, 70, 70]);
    await start(ctx(1, undefined, ["RH"], [4]), 90);
    await start(ctx(1), 60);
    expect(await bpms(id)).toEqual([80, 70, 90, 60]);
    expect((await repository.read(routine)).states).toHaveLength(3);
  });

  it("evaluates every section on its own history inside one logged session", async () => {
    const [a, b] = [ctx(1, 1), ctx(1, 2)];
    const t = await addTask({ itemId: 1, date: "2026-10-30", plan: [entry(1), entry(2)] });
    const s1 = await start(a), s2 = await start(b);
    const days = ["2026-10-22", "2026-10-23", "2026-10-24"];
    // A succeeds three times, B fails twice then succeeds once.
    await db.tasks.update(t, { plan: [entry(1, 70, { progression: { id: s1.id, cycle: 1, minConfidence: 4 } }), entry(2, 70, { progression: { id: s2.id, cycle: 1, minConfidence: 4 } })] });
    for (const [i, day] of days.entries()) await study(t, day, [{ segmentId: 1 }, { segmentId: 2, confidence: i < 2 ? 2 : 5 }]);
    expect((await suggestion(a))?.tempo).toEqual({ bpm: 72, noteVal: "quarter" });
    expect(await suggestion(b)).toBeUndefined();
    expect((await useCase.view(routine, b)).evaluation).toMatchObject({ evaluated: 3, trailingFailures: 0, trailingSuccesses: 1 });
  });

  it("runs sections at different cycles side by side", async () => {
    const t = await addTask({ itemId: 1, date: "2026-10-23", plan: [entry(1), entry(2)] });
    const s1 = await start(ctx(1, 1)), s2 = await start(ctx(1, 2));
    await db.tasks.update(t, { plan: [entry(1, 70, { progression: { id: s1.id, cycle: 1, minConfidence: 4 } }), entry(2, 70, { progression: { id: s2.id, cycle: 1, minConfidence: 4 } })] });
    for (const day of ["2026-10-22", "2026-10-22", "2026-10-22"]) await study(t, day, [{ segmentId: 1 }]);
    const bump = (await useCase.preview({ owner: routine, context: ctx(1, 1) }))!;
    expect(bump.proposed.bpm).toBe(72);
    await useCase.accept(bump);
    const states = (await repository.read(routine)).states;
    expect(states.find(s => s.id === s1.id)?.cycle).toBe(2);
    expect(states.find(s => s.id === s2.id)?.cycle).toBe(1);
    expect((await useCase.view(routine, ctx(1, 1))).evaluation?.evaluated).toBe(0);
  });
});

describe("routines built from several library items", () => {
  it("updates a combined task per item and never crosses into other items", async () => {
    const combined = await addTask({ linkType: "free", itemId: undefined, plan: [entry(1), entry(2), entry(4), entry(5)] });
    const solo1 = await addTask({ itemId: 1, plan: [entry()] });
    const solo2 = await addTask({ itemId: 2, plan: [entry()] });
    const solo3 = await addTask({ itemId: 3, plan: [entry()] });
    await start(ctx(2, 4), 66);
    expect(await bpms(combined)).toEqual([70, 70, 66, 70]);
    expect([await bpms(solo1), await bpms(solo2), await bpms(solo3)]).toEqual([[70], [70], [70]]);
    await start(ctx(2), 55);
    expect([await bpms(solo2)][0]).toEqual([55]);
    expect(await bpms(combined)).toEqual([70, 70, 66, 70]);
    await start(ctx(1), 58);
    expect(await bpms(solo1)).toEqual([58]);
    expect(await bpms(combined)).toEqual([70, 70, 66, 70]);
  });

  it("ties each entry of a combined task to its own state and cycle reference", async () => {
    const combined = await addTask({ linkType: "free", itemId: undefined, plan: [entry(1), entry(4)] });
    const a = await start(ctx(1, 1), 72), d = await start(ctx(2, 4), 64);
    expect((await planOf(combined)).map(e => [e.bpm, e.progression?.id])).toEqual([[72, a.id], [64, d.id]]);
  });

  it("evaluates items independently from one combined session", async () => {
    const combined = await addTask({ linkType: "free", itemId: undefined, plan: [entry(1), entry(4)] });
    await start(ctx(1, 1)); await start(ctx(2, 4));
    for (const day of ["2026-10-22", "2026-10-23", "2026-10-24"]) await study(combined, day, [{ segmentId: 1 }, { segmentId: 4, confidence: 2 }]);
    expect((await suggestion(ctx(1, 1)))?.direction).toBe("increase");
    expect((await suggestion(ctx(2, 4)))).toMatchObject({ direction: "decrease", tempo: { bpm: 67, noteVal: "quarter" } });
  });

  it("rejects a section that belongs to another item and skips such entries in plans", async () => {
    await addTask({ itemId: 1, plan: [entry(4)] });
    await expect(useCase.preview({ owner: routine, context: ctx(1, 4), initialTempo: { bpm: 70, noteVal: "quarter" } })).rejects.toThrow("Invalid tempo context");
    const mismatched = await addTask({ itemId: 1, plan: [entry(4)] });
    await start(ctx(2, 4), 66);
    expect(await bpms(mismatched)).toEqual([70]);
  });

  it("leaves collection tasks without a resolvable item untouched", async () => {
    const collection = await addTask({ linkType: "collection", collectionId: 1, itemId: undefined, plan: [entry()] });
    await addTask({ itemId: 1, plan: [entry()] });
    await start(ctx(1), 61);
    expect(await bpms(collection)).toEqual([70]);
  });

  it("keeps two routines of the same item apart", async () => {
    const mine = await addTask({ itemId: 1 }), other = await addTask({ itemId: 1, studyRoutineId: 2 });
    const ownerTwo: TempoOwner = { kind: "routine", id: 2 };
    await start(ctx(1), 80);
    expect([await bpms(mine), await bpms(other)]).toEqual([[80], [70]]);
    await start(ctx(1), 90, ownerTwo);
    expect([await bpms(mine), await bpms(other)]).toEqual([[80], [90]]);
    const stateOne = (await repository.read(routine)).states[0];
    await study(other, "2026-10-22", [{ progression: { id: (await repository.read(ownerTwo)).states[0].id, cycle: 1, minConfidence: 4 } }]);
    expect((await useCase.view(routine, ctx(1))).evaluation?.evaluated).toBe(0);
    expect(stateOne.owner).toEqual(routine);
  });
});

describe("recurring tasks", () => {
  const recurrence = { frequency: "weekly" } as never;
  const owner: TempoOwner = { kind: "recurrence", id: 1 };
  beforeEach(async () => {
    nextTask = 1;
    await db.tasks.clear();
    const root = await addTask({ itemId: 1, studyRoutineId: undefined, recurrence, plan: [entry(1), entry(2)] });
    await repository.configure({ kind: "recurrence", id: root }, rule, at);
    for (const d of ["24", "25", "26"]) await addTask({ itemId: 1, studyRoutineId: undefined, recurrenceTaskId: root, date: `2026-10-${d}`, plan: [entry(1), entry(2)] });
  });

  it("updates the root and all open occurrences for the touched section only", async () => {
    await start(ctx(1, 2), 77, owner);
    for (const id of [1, 2, 3, 4]) expect(await bpms(id)).toEqual([70, 77]);
  });

  it.each([
    ["done", { done: true }], ["skipped", { skipped: true }], ["deleted", { deletedAt: 1 }], ["customized", { customized: true }], ["past", { date: "2026-10-21" }],
  ])("protects a %s occurrence", async (reason, patch) => {
    await db.tasks.update(3, patch);
    const preview = (await useCase.preview({ owner, context: ctx(1, 1), initialTempo: { bpm: 77, noteVal: "quarter" } }))!;
    expect(preview.excluded).toContainEqual({ taskId: 3, reason: reason === "deleted" || reason === "skipped" || reason === "done" ? "closed" : reason });
    await useCase.accept(preview);
    expect(await bpms(3)).toEqual([70, 70]);
    expect(await bpms(2)).toEqual([77, 70]);
  });

  it("protects a studied occurrence and the source of the new cycle", async () => {
    const state = await start(ctx(1, 1), 70, owner);
    const day = "2026-10-22";
    for (const id of [2, 3, 4]) { await db.tasks.update(id, { plan: [entry(1, 70, { progression: { id: state.id, cycle: 1, minConfidence: 4 } }), entry(2)] }); await study(id, day, [{ segmentId: 1 }]); }
    const next = (await useCase.preview({ owner, context: ctx(1, 1), sourceTaskId: 3 }))!;
    expect(next.proposed.bpm).toBe(72);
    expect(next.excluded.map(e => [e.taskId, e.reason]).sort()).toEqual([[2, "studied"], [3, "source"], [4, "studied"]]);
    expect(next.updates.map(u => u.taskId)).toEqual([1]);
  });

  it("does not follow occurrences of another recurrence", async () => {
    const stranger = await addTask({ itemId: 1, studyRoutineId: undefined, recurrence, plan: [entry(1)] });
    await start(ctx(1, 1), 99, owner);
    expect(await bpms(stranger)).toEqual([70]);
  });
});

describe("a full progression cycle", () => {
  it("climbs after M successes, resets the count in the new cycle and ignores old results", async () => {
    const future = await addTask({ itemId: 1, date: "2026-11-05" });
    const state = await start(ctx(1), 70);
    const ref = { id: state.id, cycle: 1, minConfidence: 4 };
    const sessions: number[] = [];
    for (const [i, day] of ["2026-10-22", "2026-10-23", "2026-10-24"].entries()) {
      const t = await addTask({ itemId: 1, date: day, plan: [entry(undefined, 70, { progression: ref })] });
      sessions.push(await study(t, day, [{}]));
      expect((await suggestion(ctx(1)))?.tempo.bpm).toBe(i === 2 ? 72 : undefined);
    }
    const preview = (await useCase.preview({ owner: routine, context: ctx(1), sourceTaskId: 3 }))!;
    expect(preview.updates.map(u => u.taskId)).toContain(future);
    await useCase.accept(preview);
    expect(await bpms(future)).toEqual([72]);
    expect((await planOf(future))[0].progression).toEqual({ id: state.id, cycle: 2, minConfidence: 4 });
    expect((await useCase.view(routine, ctx(1))).evaluation).toMatchObject({ evaluated: 0, successes: 0 });
    expect(await suggestion(ctx(1))).toBeUndefined();
  });

  it("steps down after consecutive failures and goes back up only after fresh successes", async () => {
    await addTask({ itemId: 1, date: "2026-11-01" });
    const state = await start(ctx(1), 70);
    const ref = { id: state.id, cycle: 1, minConfidence: 4 };
    const log = async (day: string, confidence: number, bpm = 70) => { const t = await addTask({ itemId: 1, date: day, plan: [entry(undefined, 70, { progression: ref })] }); await study(t, day, [{ confidence, bpm }]); };
    await log("2026-10-22", 2);
    expect(await suggestion(ctx(1))).toBeUndefined();
    await log("2026-10-23", 3);
    expect(await suggestion(ctx(1))).toMatchObject({ direction: "decrease", tempo: { bpm: 67 } });
    await log("2026-10-24", 5);
    expect(await suggestion(ctx(1))).toBeUndefined();
    await log("2026-10-25", 5, 60);
    expect((await useCase.view(routine, ctx(1))).evaluation?.trailingFailures).toBe(1);
  });

  it("counts a result below the expected tempo as a failure even with high confidence", async () => {
    await addTask({ itemId: 1, date: "2026-11-01" });
    const state = await start(ctx(1), 70);
    const t = await addTask({ itemId: 1, date: "2026-10-23", plan: [entry(undefined, 70, { progression: { id: state.id, cycle: 1, minConfidence: 4 } })] });
    await study(t, "2026-10-22", [{ confidence: 5, bpm: 65 }]);
    expect((await useCase.view(routine, ctx(1))).evaluation).toMatchObject({ evaluated: 1, trailingFailures: 1 });
  });

  it("goes stale when a session is logged between preview and confirmation", async () => {
    await addTask({ itemId: 1, date: "2026-11-01" });
    const state = await start(ctx(1), 70);
    const t = await addTask({ itemId: 1, date: "2026-10-23", plan: [entry(undefined, 70, { progression: { id: state.id, cycle: 1, minConfidence: 4 } })] });
    for (const day of ["2026-10-22", "2026-10-22", "2026-10-22"]) await study(t, day, [{}]);
    const preview = (await useCase.preview({ owner: routine, context: ctx(1) }))!;
    await study(t, "2026-10-22", [{ confidence: 1 }]);
    expect((await useCase.accept(preview)).status).toBe("stale");
    expect((await repository.read(routine)).states[0].cycle).toBe(1);
  });

  it("does nothing while the rule is disabled and resumes with a new cycle once re-enabled", async () => {
    await addTask({ itemId: 1 });
    const state = await start(ctx(1), 70);
    await repository.configure(routine, { ...rule, enabled: false }, at);
    expect(await useCase.preview({ owner: routine, context: ctx(1), initialTempo: { bpm: 80, noteVal: "quarter" } })).toBeNull();
    expect((await useCase.view(routine, ctx(1))).evaluation).toBeUndefined();
    await repository.configure(routine, rule, at);
    expect((await repository.read(routine)).states.find(s => s.id === state.id)?.cycle).toBeGreaterThan(1);
  });

  it("offers the best earlier result of the piece as a starting point for a new context", async () => {
    const t = await addTask({ itemId: 1, plan: [entry(undefined, 70)] });
    await study(t, "2026-10-10", [{ bpm: 64, confidence: 5 }]);
    await study(t, "2026-10-12", [{ bpm: 68, confidence: 3 }]);
    const view = await useCase.view(routine, ctx(1));
    expect(view.state).toBeUndefined();
    expect(view.initial?.mark.bpm).toBe(64);
  });
});

describe("new occurrences inherit the working tempo", () => {
  const states = [1, 2].map(i => ({ id: i, owner: routine, context: ctx(1, i), contextKey: tempoContextKey(ctx(1, i)), tempo: { bpm: 80 + i, noteVal: "quarter" as const }, cycle: i, startedAt: 1, ruleRevision: 1 }));
  const segs = [{ id: 1, itemId: 1 }, { id: 2, itemId: 1 }, { id: 4, itemId: 2 }];
  const task = (patch: Partial<Task> = {}) => ({ id: 9, title: "T", subjectId: 1, date: "2026-10-30", plan: [entry(1), entry(2), entry(4)], done: false, createdAt: 1, studyRoutineId: 1, itemId: 1, ...patch }) as Task;
  it("applies each entry's own state and leaves unknown entries", () => {
    const plan = inheritTempoProgressions(task(), states, rule, segs).plan;
    expect(plan.map(e => [e.bpm, e.progression?.cycle])).toEqual([[81, 1], [82, 2], [70, undefined]]);
  });
  it.each([
    ["customized", task({ customized: true }), rule],
    ["rule disabled", task(), { ...rule, enabled: false }],
    ["no rule", task(), undefined],
    ["other owner", task({ studyRoutineId: 2 }), rule],
  ])("leaves the plan alone when %s", (_name, t, r) => {
    expect(inheritTempoProgressions(t as Task, states, r as TempoProgressionRule | undefined, segs).plan.map(e => e.bpm)).toEqual([70, 70, 70]);
  });
});
