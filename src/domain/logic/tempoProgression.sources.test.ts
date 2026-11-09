import { describe, expect, it } from "vitest";
import type { Task } from "@/domain/entities/task";
import type { SegmentEntry } from "@/domain/entities/common";
import type { TempoObservation, TempoProgression, TempoProgressionRule } from "@/domain/entities/tempoProgression";
import { evaluateTempoProgression, inheritTempoProgressions, planTempoUpdates, resolveTempoContext, tempoContextKey, tempoOwner } from "./tempoProgression";

const entry = (segmentId?: number, bpm = 80): SegmentEntry => ({ segmentId, bpm, noteVal: "quarter", layers: [], techniques: [] });
const base = (over: Partial<Task>): Task => ({ id: 1, title: "T", subjectId: 1, itemId: 1, date: "2030-01-10", plan: [entry()], done: false, createdAt: 1, ...over });
const segments = [{ id: 10, itemId: 1 }, { id: 11, itemId: 1 }, { id: 20, itemId: 2 }];
const rule: TempoProgressionRule = { enabled: true, successes: 2, minConfidence: 4, increase: { kind: "percent", value: 10 }, decrease: { failures: 2, step: { kind: "percent", value: 10 } } };

describe("progression sources", () => {
  it("routine task is owned by its routine", () => expect(tempoOwner(base({ studyRoutineId: 7 }))).toEqual({ kind: "routine", id: 7 }));
  it("recurrence occurrence is owned by its series", () => expect(tempoOwner(base({ recurrenceTaskId: 3 }))).toEqual({ kind: "recurrence", id: 3 }));
  it("recurrence template owns itself", () => expect(tempoOwner(base({ id: 3, recurrence: { kind: "interval", everyXDays: 1, startDate: "2030-01-01" } }))).toEqual({ kind: "recurrence", id: 3 }));
  it("one-off task has no progression", () => expect(tempoOwner(base({}))).toBeUndefined());
});

describe("subtask contexts", () => {
  it("whole item resolves to the task item", () => expect(resolveTempoContext(base({}), entry(), segments)?.segmentId).toBeUndefined());
  it("section resolves to its own item", () => expect(resolveTempoContext(base({}), entry(11), segments)).toMatchObject({ itemId: 1, segmentId: 11 }));
  it("section from another piece is rejected", () => expect(resolveTempoContext(base({}), entry(20), segments)).toBeUndefined());
  it("each section has a distinct key", () => expect(tempoContextKey({ itemId: 1, segmentId: 10, layers: [], techniques: [] })).not.toBe(tempoContextKey({ itemId: 1, segmentId: 11, layers: [], techniques: [] })));
});

const ctx10 = { itemId: 1, segmentId: 10, layers: [], techniques: [] };
const state: TempoProgression = { id: 5, owner: { kind: "routine", id: 7 }, context: ctx10, contextKey: tempoContextKey(ctx10), tempo: { bpm: 80, noteVal: "quarter" }, cycle: 1, startedAt: 0, ruleRevision: 0 };
const obs = (sessionId: number, bpm: number, confidence: number): TempoObservation => ({ sessionId, date: `2030-01-0${sessionId}`, createdAt: sessionId, context: ctx10, mark: { segmentId: 10, bpm, noteVal: "quarter", confidence, layers: [], techniques: [], targetBpm: 80, targetNoteVal: "quarter", progression: { id: 5, cycle: 1, minConfidence: 4 } } });

describe("suggestions", () => {
  it("suggests +10% after 2 confident sessions at target", () => expect(evaluateTempoProgression(rule, state, [obs(1, 80, 4), obs(2, 82, 5)], "2030-01-01").suggestion).toEqual({ direction: "increase", tempo: { bpm: 88, noteVal: "quarter" }, reason: "successes" }));
  it("no suggestion after only one success", () => expect(evaluateTempoProgression(rule, state, [obs(1, 80, 5)], "2030-01-01").suggestion).toBeUndefined());
  it("suggests -10% after 2 failures", () => expect(evaluateTempoProgression(rule, state, [obs(1, 80, 2), obs(2, 70, 5)], "2030-01-01").suggestion).toMatchObject({ direction: "decrease", tempo: { bpm: 72 } }));
  it("disabled rule never suggests", () => expect(evaluateTempoProgression({ ...rule, enabled: false }, state, [obs(1, 80, 5), obs(2, 80, 5)], "2030-01-01").suggestion).toBeUndefined());
});

describe("planning updates across sources", () => {
  const routineTask = (id: number, over: Partial<Task> = {}) => base({ id, studyRoutineId: 7, plan: [entry(10), entry(11, 90)], ...over });
  const tasks = [routineTask(1, { date: "2030-01-09" }), routineTask(2), routineTask(3, { customized: true }), routineTask(4, { done: true }), routineTask(5, { studyRoutineId: 8 }), base({ id: 6, recurrenceTaskId: 7, plan: [entry(10)] })];
  const { updates, excluded } = planTempoUpdates({ owner: { kind: "routine", id: 7 }, context: ctx10, tempo: { bpm: 88, noteVal: "quarter" }, tasks, observations: [], segments, fromDate: "2030-01-10" });
  it("updates only future open tasks of the same routine", () => expect(updates.map(u => u.taskId)).toEqual([2]));
  it("changes only the matching section, not sibling subtasks", () => expect(updates[0].plan.map(e => e.bpm)).toEqual([88, 90]));
  it("reports why the others were skipped", () => expect(excluded).toEqual([{ taskId: 1, reason: "past" }, { taskId: 3, reason: "customized" }, { taskId: 4, reason: "closed" }]));
});

describe("inheritance on new tasks", () => {
  const task = base({ studyRoutineId: 7, plan: [entry(10, 60), entry(11, 60)] });
  it("new routine task inherits the working tempo for the section", () => expect(inheritTempoProgressions(task, [state], rule, segments).plan.map(e => e.bpm)).toEqual([80, 60]));
  it("customized task keeps its own tempo", () => expect(inheritTempoProgressions({ ...task, customized: true }, [state], rule, segments).plan[0].bpm).toBe(60));
  it("task of another source does not inherit", () => expect(inheritTempoProgressions(base({ recurrenceTaskId: 7, plan: [entry(10, 60)] }), [state], rule, segments).plan[0].bpm).toBe(60));
});
