import type { SegmentEntry, Tempo } from "../entities/common";
import type { Segment } from "../entities/library";
import type { Task } from "../entities/task";
import type { TempoContext, TempoEvaluation, TempoObservation, TempoOwner, TempoPlanExclusion, TempoPlanUpdate, TempoProgression, TempoProgressionRef, TempoProgressionRule } from "../entities/tempoProgression";
import { BPM_MAX, BPM_MIN, NOTE_VALUES } from "../constants/noteValues";
import { compareTempos, stepTempo } from "./tempo";

export const tempoContextKey = (c: TempoContext): string => JSON.stringify([c.itemId, c.segmentId ?? null, [...new Set(c.layers)].sort(), [...new Set(c.techniques)].sort((a,b) => a-b)]);
export function resolveTempoContext(task: Task, entry: SegmentEntry, segments: readonly Pick<Segment, "id" | "itemId">[]): TempoContext | undefined {
  const segment = entry.segmentId === undefined ? undefined : segments.find(s => s.id === entry.segmentId);
  const itemId = segment?.itemId ?? (entry.segmentId === undefined ? task.itemId : undefined);
  if (itemId === undefined || (segment && task.itemId !== undefined && segment.itemId !== task.itemId)) return undefined;
  return { itemId, segmentId: entry.segmentId, layers: [...entry.layers], techniques: [...entry.techniques] };
}
export const tempoOwner = (task: Task): TempoOwner | undefined => task.studyRoutineId !== undefined ? { kind: "routine", id: task.studyRoutineId } : task.recurrenceTaskId !== undefined ? { kind: "recurrence", id: task.recurrenceTaskId } : task.recurrence && task.id !== undefined ? { kind: "recurrence", id: task.id } : undefined;
export const belongsToOwner = (task: Task, owner: TempoOwner): boolean => { const actual = tempoOwner(task); return actual?.kind === owner.kind && actual.id === owner.id; };
const validTempo = (bpm: number | undefined, noteVal: unknown): boolean => Number.isInteger(bpm) && bpm! >= BPM_MIN && bpm! <= BPM_MAX && NOTE_VALUES.includes(noteVal as Tempo["noteVal"]);
const qualified = (o: TempoObservation, context: TempoContext, confidence: number): boolean => tempoContextKey(o.context) === tempoContextKey(context) && validTempo(o.mark.bpm, o.mark.noteVal) && Number.isInteger(o.mark.confidence) && o.mark.confidence! >= confidence && o.mark.confidence! <= 5;
const ordered = (observations: readonly TempoObservation[]): TempoObservation[] => [...observations].sort((a,b) => a.date.localeCompare(b.date) || a.createdAt-b.createdAt || a.sessionId-b.sessionId);
export const initialTempo = (context: TempoContext, observations: readonly TempoObservation[], minConfidence: number): TempoObservation | undefined => ordered(observations).filter(o => qualified(o, context, minConfidence)).at(-1);
export const targetEvidence = (state: TempoProgression, observations: readonly TempoObservation[], target: Tempo): TempoObservation | undefined => ordered(observations).filter(o => o.mark.progression?.id === state.id && qualified(o, state.context, o.mark.progression.minConfidence) && compareTempos(o.mark as Tempo, target) >= 0).at(-1);

export function evaluateTempoProgression(rule: TempoProgressionRule, state: TempoProgression, observations: readonly TempoObservation[], cycleStartDate: string): TempoEvaluation {
  const result: TempoEvaluation = { evaluated: 0, successes: 0, trailingSuccesses: 0, trailingFailures: 0 };
  if (!rule.enabled) return result;
  const seen = new Set<number>();
  const successes = ordered(observations).filter(o => {
    const ref = o.mark.progression;
    if (seen.has(o.sessionId) || ref?.id !== state.id || ref.cycle !== state.cycle || o.date < cycleStartDate || !qualified(o, state.context, 1) || !validTempo(o.mark.targetBpm, o.mark.targetNoteVal) || compareTempos({ bpm: o.mark.targetBpm!, noteVal: o.mark.targetNoteVal! }, state.tempo) !== 0) return false;
    seen.add(o.sessionId); return true;
  }).map(o => o.mark.confidence! >= rule.minConfidence && compareTempos(o.mark as Tempo, state.tempo) >= 0);
  result.evaluated = successes.length;
  result.successes = (rule.window === undefined ? successes : successes.slice(-rule.window)).filter(Boolean).length;
  for (let i = successes.length-1; i >= 0 && successes[i]; i--) result.trailingSuccesses++;
  for (let i = successes.length-1; i >= 0 && !successes[i]; i--) result.trailingFailures++;
  const reduce = rule.decrease && result.trailingFailures >= rule.decrease.failures;
  const increase = (rule.window === undefined ? result.trailingSuccesses : result.successes) >= rule.successes;
  if (reduce || increase) {
    const direction = reduce ? "decrease" : "increase";
    const tempo = stepTempo(state.tempo, reduce ? rule.decrease!.step : rule.increase, direction);
    if (tempo) result.suggestion = { direction, tempo, reason: reduce ? "failures" : "successes" };
    else result.blocked = "tempo-out-of-range";
  }
  return result;
}

export function planTempoUpdates(input: { owner: TempoOwner; context: TempoContext; tempo: Tempo; reference?: TempoProgressionRef; tasks: readonly Task[]; observations: readonly TempoObservation[]; segments: readonly Pick<Segment, "id" | "itemId">[]; fromDate: string; sourceTaskId?: number }): { updates: TempoPlanUpdate[]; excluded: TempoPlanExclusion[] } {
  const updates: TempoPlanUpdate[] = [], excluded: TempoPlanExclusion[] = [];
  for (const task of [...input.tasks].sort((a,b) => a.date.localeCompare(b.date) || a.id!-b.id!)) {
    if (task.id === undefined || !belongsToOwner(task, input.owner)) continue;
    const matches = (entry: SegmentEntry) => { const c = resolveTempoContext(task, entry, input.segments); return c !== undefined && tempoContextKey(c) === tempoContextKey(input.context); };
    if (!task.plan.some(matches)) continue;
    const studied = task.plan.some(e => matches(e) && input.observations.some(o => o.taskId === task.id && o.mark.segmentId === e.segmentId));
    const reason = task.id === input.sourceTaskId ? "source" : task.deletedAt !== undefined || task.done || task.skipped ? "closed" : task.customized ? "customized" : task.date < input.fromDate ? "past" : studied ? "studied" : undefined;
    if (reason) excluded.push({ taskId: task.id, reason });
    else updates.push({ taskId: task.id, date: task.date, plan: task.plan.map(e => matches(e) ? { ...e, ...input.tempo, progression: input.reference } : e) });
  }
  return { updates, excluded };
}

export function inheritTempoProgressions(task: Task, states: readonly TempoProgression[], rule: TempoProgressionRule | undefined, segments: readonly Pick<Segment,"id"|"itemId">[]): Task {
  if (!rule?.enabled || task.customized) return task;
  return { ...task, plan: task.plan.map(entry => {
    const context = resolveTempoContext(task,entry,segments);
    const state = context && states.find(s => belongsToOwner(task,s.owner) && s.contextKey === tempoContextKey(context));
    return state ? { ...entry, ...state.tempo, progression: { id: state.id, cycle: state.cycle, minConfidence: rule.minConfidence } } : entry;
  }) };
}
