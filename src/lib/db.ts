/** @deprecated Legacy type/export facade. Dexie implementation lives in infrastructure. */
export { db } from "@/infrastructure/dexie/db";
export type { HelpRequest, PendingAssignment, StudyPoolEntry, StudyGroup, StudyRoutine } from "@/infrastructure/dexie/db";
export { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
export type { TheoryLayer } from "@/domain/constants/theoryLayers";
export type { ColorKey, Draft, Lang, LibraryKind, NoteVal, ReminderFreq, SegmentMetric, SessionQuality, Subject, SubjectType, Technique } from "@/domain/entities/common";
export type { Collection, CollectionItem } from "@/domain/entities/collection";
export type { Assignment, Lesson, LessonFrequency, LessonRecurrence, LessonScheduleSlot, LessonSnapshot } from "@/domain/entities/lesson";
export type { LibraryItem, Segment } from "@/domain/entities/library";
export type { Profile } from "@/domain/entities/profile";
export type { Session, SessionSnapshot } from "@/domain/entities/session";
export type { Task, TaskLinkType, TaskRecurrence } from "@/domain/entities/task";
