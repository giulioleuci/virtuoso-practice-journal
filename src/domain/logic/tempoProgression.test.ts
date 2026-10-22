import { expect, it } from "vitest";
import type { TempoObservation, TempoProgression, TempoProgressionRule } from "../entities/tempoProgression";
import { evaluateTempoProgression, initialTempo, planTempoUpdates, resolveTempoContext, targetEvidence, tempoContextKey } from "./tempoProgression";
import { tempoRuleSchema } from "@/lib/schemas";

const context = { itemId: 9, segmentId: 1, layers: ["RH"], techniques: [1] };
const rule: TempoProgressionRule = { enabled: true, successes: 3, window: 5, minConfidence: 4, increase: { kind: "fixed", value: 2, noteVal: "quarter" }, decrease: { failures: 2, step: { kind: "percent", value: 5 } } };
const state: TempoProgression = { id: 1, owner: { kind: "routine", id: 1 }, context, contextKey: tempoContextKey(context), tempo: { bpm: 70, noteVal: "quarter" }, cycle: 1, startedAt: 1, ruleRevision: 1 };
const observation = (id: number, confidence = 4): TempoObservation => ({ sessionId: id, taskId: 1, date: "2026-10-22", createdAt: id, context, mark: { segmentId: 1, bpm: 140, noteVal: "eighth", confidence, targetBpm: 70, targetNoteVal: "quarter", layers: ["RH"], techniques: [1], progression: { id: 1, cycle: 1, minConfidence: 4 } } });
const evaluate = (observations: TempoObservation[], config = rule) => evaluateTempoProgression(config, state, observations, "2026-10-22");
it("prioritizes reduction; counts evaluable observations only, without waiting for M", () => {
  expect(evaluate([1,2,3,4,5].map(i => observation(i, i > 3 ? 3 : 4))).suggestion).toEqual({ direction: "decrease", tempo: { bpm: 67, noteVal: "quarter" }, reason: "failures" });
  expect(evaluate([1,2,3].map(i => observation(i)), { ...rule, window: 10 }).suggestion?.direction).toBe("increase");
  const missing = observation(1); delete missing.mark.confidence;
  expect(evaluate([missing]).evaluated).toBe(0);
  expect(evaluate([observation(1, 3)]).trailingFailures).toBe(1);
  expect(evaluate([observation(1),observation(2,3),observation(3)], { ...rule, window: undefined }).suggestion).toBeUndefined();
  expect(evaluate([observation(1),observation(1),observation(1)]).evaluated).toBe(1);
});
it("isolates context, cycle, expected tempo and study date", () => {
  for (const patch of [{ progression: { id: 1, cycle: 2, minConfidence: 4 } }, { progression: { id: 2, cycle: 1, minConfidence: 4 } }, { targetBpm: 60 }, { noteVal: undefined }]) {
    const o = observation(1); Object.assign(o.mark, patch); expect(evaluate([o]).evaluated).toBe(0);
  }
  expect(evaluate([{ ...observation(1), date: "2026-10-21" }]).evaluated).toBe(0);
  expect(evaluate([{ ...observation(1), context: { ...context, itemId: 8 } }]).evaluated).toBe(0);
});
it("canonicalizes sets and resolves combined tasks by segment", () => {
  expect(tempoContextKey({ itemId: 9, layers: ["RH","LH","RH"], techniques: [2,1] })).toBe(tempoContextKey({ itemId: 9, layers: ["LH","RH"], techniques: [1,2] }));
  const task = { id: 1, studyRoutineId: 1, date: "2026-10-23", title: "Combined", subjectId: 1, linkType: "free" as const, plan: [observation(1).mark], done: false, createdAt: 1 };
  const segments = [{ id: 1, itemId: 9, label: "A", position: 0, layers: [], createdAt: 1 }];
  expect(resolveTempoContext(task, task.plan[0], segments)).toEqual(context);
  expect(planTempoUpdates({ owner: state.owner, context, tempo: { bpm: 72, noteVal: "quarter" }, tasks: [task], observations: [], segments, fromDate: "2026-10-22" }).updates[0].plan[0].bpm).toBe(72);
  const protectedResult = planTempoUpdates({ owner: state.owner, context, tempo: state.tempo, tasks: [task], observations: [{ ...observation(1), mark: { segmentId: 1, layers: [], techniques: [] } }], segments, fromDate: "2026-10-22" });
  expect(protectedResult.updates).toEqual([]); expect(protectedResult.excluded[0].reason).toBe("studied");
});
it("uses latest qualified source and preserves target evidence across cycles with historical S", () => {
  const old = observation(1); old.mark.bpm = 200;
  expect(initialTempo(context, [observation(2),old], 4)?.sessionId).toBe(2);
  expect(targetEvidence({ ...state, cycle: 2 }, [old], { bpm: 90, noteVal: "quarter" })?.sessionId).toBe(1);
  expect(targetEvidence(state, [], state.tempo)).toBeUndefined();
});
it("validates configurable rules at the boundary", () => {
  expect(tempoRuleSchema.safeParse(rule).success).toBe(true);
  for (const patch of [{ successes: 0 }, { successes: 1.5 }, { window: 0 }, { window: 2 }, { window: "" }, { minConfidence: 6 }, { increase: { kind: "percent", value: NaN } }, { increase: { kind: "percent", value: Infinity } }, { decrease: { failures: 2, step: { kind: "percent", value: 100 } } }]) expect(tempoRuleSchema.safeParse({ ...rule, ...patch }).success).toBe(false);
});
