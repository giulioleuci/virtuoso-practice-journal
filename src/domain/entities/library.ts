import type { LibraryKind, NoteVal, StudyStatus } from "./common";

export interface LibraryItem {
  id?: number;
  subjectId: number;
  kind: LibraryKind;
  title: string;
  composer?: string;
  catalog?: string;
  notes?: string;
  studyStatus: StudyStatus;
  startBpm?: number;
  targetBpm?: number;
  noteVal?: NoteVal;
  techniqueIds?: number[];
  tags?: string[];
  /** Explicit "to keep" flag: the material is permanently part of the repertoire. */
  inRepertoire?: boolean;
  /** Epoch ms when the item entered the repertoire. */
  repertoireAddedAt?: number;
  /** Current spaced-review interval in days (grows as reviews go well). */
  reviewIntervalDays?: number;
  /** Local `YYYY-MM-DD` key of the last repertoire review. */
  lastReviewedAt?: string;
  /** Local `YYYY-MM-DD` key of the next suggested review. */
  nextReviewAt?: string;
  createdAt: number;
  deletedAt?: number;
}


export interface Segment {
  id: number;
  itemId: number;
  label: string;
  position: number;
  barStart?: number;
  barEnd?: number;
  notes?: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers: string[];
  techniqueIds?: number[];
  createdAt: number;
  deletedAt?: number;
}

export type SegmentInput = Omit<Segment, "id" | "itemId" | "createdAt" | "deletedAt"> & { id?: number };
