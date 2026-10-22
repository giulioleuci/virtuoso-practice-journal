import type { SegmentEntry } from "../entities/common";
import type { LibraryItem, Segment } from "../entities/library";
import type { Task } from "../entities/task";
import type { TempoContext, TempoObservation, TempoOwner, TempoProgression, TempoProgressionRule } from "../entities/tempoProgression";
export type TempoOwnerData = { owner: TempoOwner; rule?: TempoProgressionRule; ruleRevision: number; states: TempoProgression[]; tasks: Task[]; observations: TempoObservation[]; segments: Segment[]; items: LibraryItem[] };
export interface TempoProgressionTransaction {
  read(owner: TempoOwner): Promise<TempoOwnerData>;
  history(context: TempoContext): Promise<TempoObservation[]>;
  putState(state: Omit<TempoProgression, "id"> & { id?: number }): Promise<number>;
  putPlan(taskId: number, plan: SegmentEntry[]): Promise<void>;
}
export interface TempoProgressionPort extends Pick<TempoProgressionTransaction, "read" | "history"> {
  configure(owner: TempoOwner, rule: TempoProgressionRule | undefined, at: number): Promise<void>;
  transaction<T>(operation: (tx: TempoProgressionTransaction) => Promise<T>): Promise<T>;
}
