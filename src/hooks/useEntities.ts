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

export const useSegments = () =>
  useLiveQuery(() => db.segments.filter((s) => !s.deletedAt).toArray(), []);

export const useActiveTasks = () =>
  useLiveQuery(() => db.tasks.filter((t) => !t.deletedAt).toArray(), []);

export const useSessions = () =>
  useLiveQuery(() => db.sessions.toArray(), []);

export const useProfile = () =>
  useLiveQuery(() => db.profile.get("me"), []);
