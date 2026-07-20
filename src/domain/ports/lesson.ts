import type { Assignment, Lesson, LessonRecurrence } from "../entities/lesson";

export interface LessonPort {
  list(): Promise<Lesson[]>;
  get(id: number): Promise<Lesson | undefined>;
  listRecurrences(): Promise<LessonRecurrence[]>;
  log(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string, notes: string | undefined, assignmentTexts: string[]): Promise<number>;
  update(id: number, patch: Partial<Lesson>): Promise<void>;
  remove(id: number): Promise<void>;
  assignmentsForLesson(lessonId: number): Promise<Assignment[]>;
}
