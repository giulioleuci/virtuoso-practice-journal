import type { ColorKey } from "./common";

export type LessonFrequency = "weekly" | "biweekly" | "monthly";

export interface LessonScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  frequency: LessonFrequency;
}

export interface LessonRecurrence {
  id?: number;
  subjectId: number;
  teacher: string;
  schedules: LessonScheduleSlot[];
  startDate: string;
  endDate?: string;
  color: ColorKey;
  createdAt: number;
  deletedAt?: number;
}

export interface LessonSnapshot {
  subjectName: string;
  teacher?: string;
  frequency?: LessonFrequency;
}

export interface LessonNote {
  id: string;
  text: string;
}

export interface Lesson {
  id?: number;
  recurrenceId?: number;
  subjectId: number;
  date: string;
  notes?: LessonNote[];
  piecesPlayed?: number[];
  piecesPlayedTitles?: string[];
  snapshot?: LessonSnapshot;
  createdAt: number;
}

/** Rows written before notes became a list hold one string: it reads as the note "legacy", so writes keep it. */
export function lessonNotes(l: Lesson): LessonNote[] {
  const notes: unknown = l.notes;
  if (Array.isArray(notes)) return notes;
  return typeof notes === "string" && notes.trim() ? [{ id: "legacy", text: notes.trim() }] : [];
}

export interface Assignment {
  id: number;
  lessonId: number;
  text: string;
  /** Tasks planned from this homework; open while empty and not ignored. */
  taskIds: number[];
  ignored?: boolean;
  createdAt: number;
}
