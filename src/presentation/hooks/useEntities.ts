/** Named presentation DTO adapters. Persistence stays behind application ports. */
import type { LibraryKind } from "@/domain/entities/common";
import { presentationQueries } from "@/application/queries/presentationQueryService";
import { usePresentationQuery } from "./usePresentationQuery";

// DTO types are inferred at each feature hook during incremental migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useRead = <T = any>(operation: string, parameters: readonly unknown[] = []) =>
  usePresentationQuery<T>(presentationQueries(), operation, parameters);

export const useSubjects = () => useRead("subjects.active");
export const useTechniques = () => useRead("techniques.active");
export const useLibrary = () => useRead("library.active");
export const useRepertoire = () => useRead("library.repertoire");
export const useLibraryByKind = (kind?: LibraryKind) => useRead("library.byKind", [kind]);
export const useSegments = () => useRead("segments.active");
export const useActiveTasks = () => useRead("tasks.active");
export const useSessions = () => useRead("sessions.all");
export const useProfile = () => useRead("profile.current");
export const useStudyRoutines = () => useRead("routines.active");
export const useRecurrences = () => useRead("recurrences.active");
export const useLessons = () => useRead("lessons.all");
export const useAssignments = () => useRead("assignments.all");
export const useHelpRequests = () => useRead("helpRequests.all");
export const useCollections = (kind?: LibraryKind) => useRead("collections.active", [kind]);
export const useCollectionLinks = () => useRead("collectionLinks.all");
export const useCollectionLinksByItem = (itemId?: number) => useRead("collectionLinks.item", [itemId]);
export const useAllTasks = () => useRead("tasks.all");
export const useAllLibrary = () => useRead("library.active");
export const useAllSegments = () => useRead("segments.active");
export const useAllCollections = () => useRead("collections.all");
export const useCollectionItems = (collectionId?: number) => useRead("collections.items", [collectionId]);
export const useItem = (id?: number) => useRead("library.item", [id]);
export const useTask = (id?: number) => useRead("tasks.one", [id]);
export const useTasksInRange = (from?: string, to?: string) => useRead("tasks.range", [from, to]);
export const useTasksByDate = (date?: string) => useRead("tasks.date", [date]);
export const useTasksByItem = (itemId?: number) => useRead("tasks.item", [itemId]);
export const useTasksBySubjectAndDate = (_subjectId?: number, date?: string) => useRead("tasks.date", [date]);
export const useRecurrencesBySubject = (_subjectId?: number) => useRead("recurrences.active");
export const useSegmentsByItem = (itemId?: number) => useRead("library.segments", [itemId]);
