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

export interface Lesson {
  id?: number;
  recurrenceId?: number;
  subjectId: number;
  date: string;
  notes?: string;
  piecesPlayed?: number[];
  piecesPlayedTitles?: string[];
  snapshot?: LessonSnapshot;
  createdAt: number;
}

export interface Assignment {
  id: number;
  lessonId: number;
  text: string;
  transformed: boolean;
  ignored?: boolean;
  taskId?: number;
  createdAt: number;
}
