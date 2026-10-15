import type { Assignment, Lesson, LessonRecurrence } from "../entities/lesson";

export interface LessonPort {
  list(): Promise<Lesson[]>;
  get(id: number): Promise<Lesson | undefined>;
  listRecurrences(): Promise<LessonRecurrence[]>;
  upsertRecurrence(data: Omit<LessonRecurrence, "id">, id?: number): Promise<number>;
  deleteRecurrence(id: number): Promise<void>;
  /** Lesson of that slot and day, created empty when missing. */
  ensureFor(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string): Promise<number>;
  log(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string, notes: string | undefined, assignmentTexts?: string[]): Promise<number>;
  update(id: number, patch: Partial<Lesson>): Promise<void>;
  remove(id: number): Promise<void>;
  assignmentsForLesson(lessonId: number): Promise<Assignment[]>;
  updateLesson(lesson: Lesson, date: string, notes: string | undefined): Promise<void>;
  addAssignment(lessonId: number, text: string): Promise<number>;
  updateAssignment(id: number, text: string): Promise<void>;
  removeAssignment(id: number): Promise<void>;
  deleteLesson(id: number): Promise<void>;
  ignoreAssignment(id: number): Promise<void>;
  restoreAssignment(id: number): Promise<void>;
  linkTask(id: number, taskId: number): Promise<void>;
  unlinkTask(id: number, taskId: number): Promise<void>;
}
