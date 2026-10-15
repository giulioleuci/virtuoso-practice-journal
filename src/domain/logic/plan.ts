import type { NoteVal, SegmentEntry, SegmentMark } from "../entities/common";
import type { Session } from "../entities/session";
import type { Task } from "../entities/task";

export const emptyEntry = (segmentId?: number): SegmentEntry => ({ segmentId, layers: [], techniques: [] });

export const planSegmentIds = (plan: SegmentEntry[]): number[] => plan.flatMap((e) => (e.segmentId === undefined ? [] : [e.segmentId]));

export const entryFor = <E extends { segmentId?: number }>(entries: E[], segmentId?: number): E | undefined => entries.find((e) => e.segmentId === segmentId);

/** Marks a session would leave for a plan (a plan with no sections gives one whole-task mark), prefilled with the plan targets. */
export const marksFromPlan = (plan: SegmentEntry[]): SegmentMark[] => (plan.length ? plan : [emptyEntry()]).map((e) => ({ ...e, targetBpm: e.bpm }));

/** Plan entries updated from `marks` only where the user picked it; a missing reached tempo keeps the planned one. Ratings never carry. */
export const carryMarksToPlan = (plan: SegmentEntry[], marks: SegmentMark[], picks: { tempo: Set<number | undefined>; extras: boolean }): SegmentEntry[] =>
  plan.map((e) => {
    const m = entryFor(marks, e.segmentId);
    if (!m) return e;
    const tempo = picks.tempo.has(e.segmentId) && m.bpm !== undefined;
    return {
      segmentId: e.segmentId,
      bpm: tempo ? m.bpm : e.bpm,
      noteVal: tempo ? m.noteVal ?? e.noteVal : e.noteVal,
      layers: picks.extras ? [...m.layers] : e.layers,
      techniques: picks.extras ? [...m.techniques] : e.techniques,
    };
  });

/** Sections where a tempo was reached that differs from the plan: the default proposal of "update next task". */
export const tempoProposal = (plan: SegmentEntry[], marks: SegmentMark[]): (number | undefined)[] =>
  plan.flatMap((e) => {
    const m = entryFor(marks, e.segmentId);
    return m?.bpm !== undefined && (m.bpm !== e.bpm || (m.noteVal ?? e.noteVal) !== e.noteVal) ? [e.segmentId] : [];
  });

/** Current marks restarted from a previous result's tempo, layers and techniques; ratings are never copied. */
export const restartFrom = (marks: SegmentMark[], previous: SegmentMark[]): SegmentMark[] =>
  marks.map((m) => {
    const p = entryFor(previous, m.segmentId);
    return p ? { ...m, bpm: p.bpm, noteVal: p.noteVal, layers: [...p.layers], techniques: [...p.techniques] } : m;
  });

export const sharesSection = (plan: SegmentEntry[], marks: SegmentMark[]): boolean => plan.some((e) => entryFor(marks, e.segmentId));

interface PlanDefaults { targetBpm?: number; noteVal?: NoteVal; layers?: string[]; techniqueIds?: number[] }

/** Entry seeded from the tempo/layers/techniques stored on a library item or section. */
export const seedEntry = (defaults?: PlanDefaults, segmentId?: number): SegmentEntry => ({
  segmentId,
  bpm: defaults?.targetBpm,
  noteVal: defaults?.noteVal,
  layers: [...(defaults?.layers ?? [])],
  techniques: [...(defaults?.techniqueIds ?? [])],
});

/** Plan for a link selection: keeps entries already edited for sections still selected, seeds the new ones. */
export const syncPlan = (plan: SegmentEntry[], segments: (PlanDefaults & { id: number })[], item?: PlanDefaults): SegmentEntry[] =>
  segments.length
    ? segments.map((s) => entryFor(plan, s.id) ?? seedEntry(s, s.id))
    : [entryFor(plan, undefined) ?? seedEntry(item)];

/** First entry with a target tempo, for one-line task summaries. */
export const firstTempo = (plan: SegmentEntry[]): SegmentEntry | undefined => plan.find((e) => e.bpm);

/** Open tasks on or after `task.date` aimed at the same target and sharing a section with `marks`, earliest first. */
export function followUpTasks<T extends Pick<Task, "id" | "date" | "subjectId" | "title" | "itemId" | "collectionId" | "done" | "skipped" | "plan">>(
  task: Pick<Task, "id" | "date" | "subjectId" | "title" | "itemId" | "collectionId">,
  marks: SegmentMark[],
  tasks: T[],
): T[] {
  const sameTarget = (c: T) =>
    task.itemId !== undefined ? c.itemId === task.itemId
      : task.collectionId !== undefined ? c.collectionId === task.collectionId
        : c.subjectId === task.subjectId && c.title === task.title;
  return tasks
    .filter((c) => c.id !== task.id && !c.done && !c.skipped && c.date >= task.date && sameTarget(c) && sharesSection(c.plan, marks))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Planned sections that none of `sessions` has a result for. */
export const remainingSegmentIds = (plan: SegmentEntry[], sessions: Pick<Session, "marks">[]): number[] => {
  const studied = new Set(sessions.flatMap((s) => s.marks.map((m) => m.segmentId)));
  return planSegmentIds(plan).filter((id) => !studied.has(id));
};

/** A task is done once its sessions cover every planned section; a task without sections needs one studied entry. */
export const planCovered = (plan: SegmentEntry[], sessions: Pick<Session, "marks">[]): boolean =>
  planSegmentIds(plan).length ? remainingSegmentIds(plan, sessions).length === 0 : sessions.some((s) => s.marks.length > 0);
