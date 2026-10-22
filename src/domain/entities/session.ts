import type { SegmentMark } from "./common";
import type { TaskLinkType } from "./task";

export interface SessionSnapshot {
  taskTitle: string;
  subjectName: string;
  itemTitle?: string;
  itemComposer?: string;
  segments?: { id: string; label: string; barStart?: number; barEnd?: number }[];
  collectionName?: string;
  techniqueNames?: string[];
}

export interface Session {
  tempoProgressionIds?: number[];
  tempoSegmentIds?: number[];
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

/** Metadata of a device-local audio clip; the audio itself lives outside every backup and is found by `uid`. */
export interface Recording {
  id?: number;
  /** Random UUID: the only link between metadata and local audio, immune to numeric id collisions on import. */
  uid: string;
  sessionId: number;
  segmentId?: number;
  date: string;
  title?: string;
  mimeType: string;
  /** Clip length for the player; never study time. */
  durationMs: number;
  createdAt: number;
}

export const sessionTempoIndexes = (marks: SegmentMark[]) => ({
  tempoProgressionIds: [...new Set(marks.flatMap(m => m.progression ? [m.progression.id] : []))].sort((a,b) => a-b),
  tempoSegmentIds: [...new Set(marks.flatMap(m => m.segmentId === undefined ? [] : [m.segmentId]))].sort((a,b) => a-b),
});
