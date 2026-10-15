import type { NoteVal } from "../constants/noteValues";

export type { NoteVal };
export type Lang = "en" | "it" | "es" | "de";
export type SubjectType = "instrument" | "theory" | "composition" | "other";
export type LibraryKind = "repertoire" | "manual" | "technique" | "theory";
export type ColorKey = "terracotta" | "sage" | "gold" | "blue" | "plum" | "coral" | "amber" | "teal" | "indigo" | "slate";
export type ReminderFreq = "daily" | "weekdays" | "custom";

/** What is planned (task) or what was done (session) on one section; `segmentId` is empty for a whole-task entry. */
export interface SegmentEntry {
  segmentId?: number;
  bpm?: number;
  noteVal?: NoteVal;
  layers: string[];
  techniques: number[];
}

/** Result of practicing one section: reached tempo, three 1-5 ratings and the planned target at that time. */
export interface SegmentMark extends SegmentEntry {
  confidence?: number;
  /** 1 very negative … 5 very positive: how working on the section felt. */
  mood?: number;
  /** 1 very low … 5 very high: how well attention held. */
  focus?: number;
  targetBpm?: number;
}

/** The three per-section ratings in display order; each is an integer 1-5. */
export const RATING_KEYS = ["mood", "focus", "confidence"] as const;
export type RatingKey = typeof RATING_KEYS[number];

export interface Subject {
  id?: number;
  name: string;
  type: SubjectType;
  layers?: string[];
  color?: ColorKey;
  customColor?: string;
  createdAt: number;
  deletedAt?: number;
}

export interface Technique {
  id: number;
  subjectId: number;
  name: string;
  createdAt: number;
  deletedAt?: number;
}

export type Draft<T extends { id?: number }> = Omit<T, "id"> & { id?: number };
