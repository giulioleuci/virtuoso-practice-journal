/** Composition root for presentation read adapters. */
import { db } from "@/infrastructure/dexie/db";
export { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
export type { ColorKey, Lang, LibraryKind, NoteVal, SegmentMetric, SessionQuality, Subject, SubjectType, TheoryLayer } from "@/domain/entities/common";
export type { Collection, CollectionItem } from "@/domain/entities/collection";
export type { Lesson, LessonFrequency, LessonRecurrence, LessonScheduleSlot } from "@/domain/entities/lesson";
export type { LibraryItem, Segment } from "@/domain/entities/library";
export type { Profile } from "@/domain/entities/profile";
export type { Session } from "@/domain/entities/session";
export type { Task, TaskLinkType, TaskRecurrence } from "@/domain/entities/task";
export type { HelpRequest } from "@/domain/ports/helpRequest";
export type { StudyPoolEntry, StudyGroup, StudyRoutine } from "@/domain/ports/studyRoutine";

// Kept outside presentation so no page/component/hook reaches Dexie directly.
export const query = db;
export { query as db };
