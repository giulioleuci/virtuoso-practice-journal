/** Centralized live-query hooks — the single read surface for the UI.
 *  Components import these instead of calling `db.<table>` directly.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind } from "@/lib/db";
import { notDeleted } from "@/lib/services/_shared";

// ── Single-table reads (active rows only where soft-delete applies) ──────────

export const useSubjects = () =>
  useLiveQuery(() => db.subjects.filter(notDeleted).toArray(), []);

export const useTechniques = () =>
  useLiveQuery(() => db.techniques.filter(notDeleted).toArray(), []);

export const useLibrary = () =>
  useLiveQuery(() => db.library.filter(notDeleted).toArray(), []);

export const useRepertoire = () =>
  useLiveQuery(
    () => db.library.where("kind").equals("repertoire").filter(notDeleted).toArray(),
    []
  );

export const useSegments = () =>
  useLiveQuery(() => db.segments.filter(notDeleted).toArray(), []);

export const useActiveTasks = () =>
  useLiveQuery(() => db.tasks.filter(notDeleted).toArray(), []);

export const useSessions = () =>
  useLiveQuery(() => db.sessions.toArray(), []);

export const useProfile = () =>
  useLiveQuery(() => db.profile.get("me"), []);

export const useStudyRoutines = () =>
  useLiveQuery(() => db.studyRoutines.filter(notDeleted).toArray(), []);

export const useRecurrences = () =>
  useLiveQuery(() => db.recurrences.filter(notDeleted).toArray(), []);

export const useLessons = () =>
  useLiveQuery(() => db.lessons.orderBy("date").reverse().toArray(), []);

export const useAssignments = () =>
  useLiveQuery(() => db.assignments.toArray(), []);

export const useHelpRequests = () =>
  useLiveQuery(() => db.helpRequests.toArray(), []);

export const useCollections = (kind?: LibraryKind) =>
  useLiveQuery(
    () => db.collections.filter((c) => notDeleted(c) && (!kind || c.kind === kind)).toArray(),
    [kind]
  );

/** All collection→item link rows (used by grouping/membership views). */
export const useCollectionLinks = () =>
  useLiveQuery(() => db.collectionItems.toArray(), []);

// Historical views need every row (including soft-deleted) so sessions/lessons
// still render context for entities the user later deleted.
export const useAllTasks = () => useLiveQuery(() => db.tasks.toArray(), []);
export const useAllLibrary = () => useLiveQuery(() => db.library.toArray(), []);
export const useAllSegments = () => useLiveQuery(() => db.segments.toArray(), []);
export const useAllCollections = () => useLiveQuery(() => db.collections.toArray(), []);

export const useCollectionItems = (collectionId?: number) =>
  useLiveQuery(
    () => collectionId ? db.collectionItems.where("collectionId").equals(collectionId).toArray() : Promise.resolve([]),
    [collectionId]
  );

// ── Keyed single-row reads ───────────────────────────────────────────────────

export const useItem = (id?: number) =>
  useLiveQuery(() => (id ? db.library.get(id) : Promise.resolve(undefined)), [id]);

/** Returns undefined while loading, null when not found, else the task. */
export const useTask = (id?: number) =>
  useLiveQuery(() => (id ? db.tasks.get(id).then((t) => t ?? null) : Promise.resolve(null)), [id]);

// ── Composed / scoped reads ──────────────────────────────────────────────────

/**
 * Live-query tasks whose `date` falls within [from, to] (inclusive).
 * Uses the indexed `date` field to avoid a full-table scan; `deletedAt`
 * is filtered in memory. Dates are expected as ISO `YYYY-MM-DD` strings.
 */
export const useTasksInRange = (from?: string, to?: string) =>
  useLiveQuery(
    () => {
      if (!from || !to) return Promise.resolve([]);
      return db.tasks
        .where("date")
        .between(from, to, true, true)
        .filter(notDeleted)
        .toArray();
    },
    [from, to],
  );

export const useTasksByDate = (date?: string) =>
  useLiveQuery(
    () => (date ? db.tasks.where("date").equals(date).filter(notDeleted).toArray() : Promise.resolve([])),
    [date],
  );

export const useTasksByItem = (itemId?: number) =>
  useLiveQuery(
    () => (itemId ? db.tasks.where("itemId").equals(itemId).toArray() : Promise.resolve([])),
    [itemId],
  );

export const useTasksBySubjectAndDate = (subjectId?: number, date?: string) =>
  useLiveQuery(
    () =>
      subjectId && date
        ? db.tasks.where("date").equals(date).filter((t) => notDeleted(t) && t.subjectId === subjectId).toArray()
        : Promise.resolve([]),
    [subjectId, date],
  );

export const useRecurrencesBySubject = (subjectId?: number) =>
  useLiveQuery(
    () =>
      subjectId
        ? db.recurrences.where("subjectId").equals(subjectId).filter(notDeleted).toArray()
        : Promise.resolve([]),
    [subjectId],
  );

export const useCollectionsByKind = (kind?: LibraryKind) => useCollections(kind);

export const useSegmentsByItem = (itemId?: number) =>
  useLiveQuery(
    () => (itemId ? db.segments.where("itemId").equals(itemId).filter(notDeleted).toArray() : Promise.resolve([])),
    [itemId],
  );
