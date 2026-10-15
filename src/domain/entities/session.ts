import type { SegmentMark } from "./common";
import type { TaskLinkType } from "./task";

export interface SessionSnapshot {
  taskTitle: string;
  subjectName: string;
  itemTitle?: string;
  itemComposer?: string;
  segments?: { id: string; label: string }[];
  collectionName?: string;
  techniqueNames?: string[];
}

export interface Session {
  id: number;
  /** Set only when the session was opened from a planned task. */
  taskId?: number;
  /** Absent only on legacy sessions whose task no longer exists. */
  subjectId?: number;
  linkType?: TaskLinkType;
  itemId?: number;
  collectionId?: number;
  date: string;
  notes?: string;
  /** One entry per studied section, or a single whole-scope entry. */
  marks: SegmentMark[];
  /** Sections of the task's plan declared not studied in this session. */
  notStudied?: number[];
  snapshot?: SessionSnapshot;
  createdAt: number;
}
