import type { NoteVal } from "./common";

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
  id?: number;
  date: string;
  subjectId: number;
  linkType?: TaskLinkType;
  itemId?: number;
  segmentIds?: number[];
  collectionId?: number;
  title: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers?: string[];
  techniqueIds?: number[];
  done: boolean;
  skipped?: boolean;
  executionNotes?: string;
  recurrenceTaskId?: number;
  recurrence?: TaskRecurrence;
  studyRoutineId?: number;
  createdAt: number;
  deletedAt?: number;
}
