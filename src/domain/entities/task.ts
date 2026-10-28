import type { SegmentEntry } from "./common";

export interface TaskRecurrence {
  kind: "weekdays" | "interval";
  days?: number[];
  everyXDays?: number;
  startDate: string;
  endDate?: string;
  occurrences?: number;
}

/** Practice order in a day, most urgent first; a task without one counts as "medium". */
export const TASK_IMPORTANCE = ["preparation", "warmup", "technique", "high", "medium", "low"] as const;
export type TaskImportance = typeof TASK_IMPORTANCE[number];

export type TaskLinkType = "free" | "item" | "collection";

export interface Task {
  tempoRule?: import("@/domain/entities/tempoProgression").TempoProgressionRule;
  tempoRuleRevision?: number;
  id?: number;
  date: string;
  subjectId: number;
  linkType?: TaskLinkType;
  itemId?: number;
  collectionId?: number;
  title: string;
  importance?: TaskImportance;
  /** Per-section targets; one entry without `segmentId` when the task has no sections. */
  plan: SegmentEntry[];
  done: boolean;
  /** Edited by hand after a routine generated it; regeneration keeps it. */
  customized?: boolean;
  skipped?: boolean;
  executionNotes?: string;
  recurrenceTaskId?: number;
  recurrence?: TaskRecurrence;
  /** Recurrence root only: last date written to the DB. */
  materializedUntil?: string;
  studyRoutineId?: number;
  createdAt: number;
  deletedAt?: number;
}
