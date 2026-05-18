/** Centralized live-query hooks for common collections.
 *  These wrap dexie's useLiveQuery to keep page components leaner.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export const useSubjects = () =>
  useLiveQuery(() => db.subjects.filter((s) => !s.deletedAt).toArray(), []);

export const useTechniques = () =>
  useLiveQuery(() => db.techniques.filter((t) => !t.deletedAt).toArray(), []);

export const useLibrary = () =>
  useLiveQuery(() => db.library.filter((i) => !i.deletedAt).toArray(), []);

export const useRepertoire = () =>
  useLiveQuery(
    () => db.library.where("kind").equals("repertoire").filter((i) => !i.deletedAt).toArray(),
    []
  );

export const useCollectionItems = (collectionId?: number) =>
  useLiveQuery(
    () => collectionId ? db.collectionItems.where("collectionId").equals(collectionId).toArray() : Promise.resolve([]),
    [collectionId]
  );

export const useSegments = () =>
  useLiveQuery(() => db.segments.filter((s) => !s.deletedAt).toArray(), []);

export const useActiveTasks = () =>
  useLiveQuery(() => db.tasks.filter((t) => !t.deletedAt).toArray(), []);

/**
 * Live-query tasks whose `date` falls within [from, to] (inclusive).
 * Uses the indexed `date` field to avoid a full-table scan; `deletedAt`
 * is filtered in memory since it isn't a covering index for this query.
 * Dates are expected as ISO `YYYY-MM-DD` strings.
 */
export const useTasksInRange = (from?: string, to?: string) =>
  useLiveQuery(
    () => {
      if (!from || !to) return Promise.resolve([]);
      return db.tasks
        .where("date")
        .between(from, to, true, true)
        .filter((t) => !t.deletedAt)
        .toArray();
    },
    [from, to],
  );

export const useSessions = () =>
  useLiveQuery(() => db.sessions.toArray(), []);

export const useProfile = () =>
  useLiveQuery(() => db.profile.get("me"), []);
