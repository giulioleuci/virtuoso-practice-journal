/** Named presentation DTO adapters. Persistence stays behind application ports. */
import type { CollectionKind, LibraryKind, Subject, Technique } from "@/domain/entities/common";
import type { Collection, CollectionItem } from "@/domain/entities/collection";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { Profile } from "@/domain/entities/profile";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import type { HelpRequest } from "@/domain/ports/helpRequest";
import type { Assignment, Lesson, LessonRecurrence } from "@/domain/entities/lesson";
import type { PerformanceEvent, PerformanceItem } from "@/domain/entities/performance";
import { presentationQueries } from "@/application/queries/presentationQueryService";
import { usePresentationQuery, usePresentationReader } from "./usePresentationQuery";

const useRead = <T>(operation: string, parameters: readonly unknown[] = []) =>
  usePresentationQuery<T>(presentationQueries(), operation, parameters);

export const useSubjects = () => useRead<Subject[]>("subjects.active");
export const useTechniques = () => useRead<Technique[]>("techniques.active");
export const useLibrary = () => useRead<LibraryItem[]>("library.active");
/** Pieces and studies available for performance programmes. */
export const usePerformableLibrary = () => useRead<LibraryItem[]>("library.performable");
/** Items the user explicitly flagged as "to keep" in the performing repertoire. */
export const useRepertoire = () => useRead<LibraryItem[]>("repertoire.active");
export const useLibraryByKind = (kind?: LibraryKind) => useRead<LibraryItem[]>("library.byKind", [kind]);
export const useSegments = () => useRead<Segment[]>("segments.active");
export const useActiveTasks = () => useRead<Task[]>("tasks.active");
export const useSessions = () => useRead<Session[]>("sessions.all");
export const useSessionsInRange = (from?: string, to?: string) => useRead<Session[]>("sessions.range", [from, to]);
export const useProfile = () => useRead<Profile | null>("profile.current");
export const useStudyRoutines = () => useRead<StudyRoutine[]>("routines.active");
export const useRecurrences = () => useRead<LessonRecurrence[]>("recurrences.active");
export const useLessons = () => useRead<Lesson[]>("lessons.all");
export const useAssignments = () => useRead<Assignment[]>("assignments.all");
export const useHelpRequests = () => useRead<HelpRequest[]>("helpRequests.all");
export const useCollections = (kind?: CollectionKind) => useRead<Collection[]>("collections.active", [kind]);
export const useCollectionLinks = () => useRead<CollectionItem[]>("collectionLinks.all");
export const useCollectionLinksByItem = (itemId?: number) => useRead<CollectionItem[]>("collectionLinks.item", [itemId]);
export const useAllTasks = () => useRead<Task[]>("tasks.all");
export const useAllLibrary = () => useRead<LibraryItem[]>("library.active");
export const useAllSegments = () => useRead<Segment[]>("segments.active");
export const useAllCollections = () => useRead<Collection[]>("collections.all");
export const useCollectionItems = (collectionId?: number) => useRead<CollectionItem[]>("collections.items", [collectionId]);
export const useCollection = (collectionId?: number) => useRead<Collection | undefined>("collections.one", [collectionId]);
export const useItem = (id?: number) => useRead<LibraryItem | undefined>("library.item", [id]);
export const useTask = (id?: number) => useRead<Task | null>("tasks.one", [id]);
export const useTasksInRange = (from?: string, to?: string) => useRead<Task[]>("tasks.range", [from, to]);
export const useTasksByDate = (date?: string) => useRead<Task[]>("tasks.date", [date]);
export const useTasksByItem = (itemId?: number) => useRead<Task[]>("tasks.item", [itemId]);
export const useTasksBySubjectAndDate = (_subjectId?: number, date?: string) => useRead<Task[]>("tasks.date", [date]);
export const useRecurrencesBySubject = (_subjectId?: number) => useRead<LessonRecurrence[]>("recurrences.active");
export const useSegmentsByItem = (itemId?: number) => useRead<Segment[]>("library.segments", [itemId]);
export const useSegmentsByIds = (ids: readonly number[]) => useRead<Segment[]>("segments.ids", [ids]);
export const useStudyRoutine = (id?: number) => useRead<StudyRoutine | null>("routines.one", [id]);
export const usePerformanceEvents = () => useRead<PerformanceEvent[]>("performances.active");
export const usePerformanceLinks = () => useRead<PerformanceItem[]>("performances.links");
export const useAssignmentsForLesson = (lessonId?: number) =>
  usePresentationReader<Assignment[]>((queries) => queries.assignmentsForLesson(lessonId), [lessonId]);
export const useOpenHelpRequestCount = () =>
  usePresentationReader<number>((queries) => queries.openHelpRequestCount());
