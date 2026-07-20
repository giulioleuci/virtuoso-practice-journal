import type { Lesson, LessonRecurrence } from "@/domain/entities/lesson";
import type { LessonPort } from "@/domain/ports/lesson";
export type LessonDto = Lesson;
export type LessonRecurrenceDto = LessonRecurrence;
export interface LessonQueries { list(): Promise<LessonDto[]>; recurrences(): Promise<LessonRecurrenceDto[]>; }
export const lessonQueries = (lessons: LessonPort): LessonQueries => ({ list: () => lessons.list(), recurrences: () => lessons.listRecurrences() });
