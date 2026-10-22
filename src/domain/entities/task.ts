import type { SegmentEntry } from "./common";

export interface TaskRecurrence {
  kind: "weekdays" | "interval";
  days?: number[];
  everyXDays?: number;
  startDate: string;
  endDate?: string;
  occurrences?: number;
}

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
  /** Per-section targets; one entry without `segmentId` when the task has no sections. */
  plan: SegmentEntry[];
  done: boolean;
  /** Edited by hand after a routine generated it; regeneration keeps it. */
  customized?: boolean;
  skipped?: boolean;
  executionNotes?: string;
  recurrenceTaskId?: number;
  recurrence?: TaskRecurrence;
  studyRoutineId?: number;
  createdAt: number;
  deletedAt?: number;
}
