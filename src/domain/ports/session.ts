import type { Recording, Session, SessionSnapshot } from "../entities/session";
import type { Task } from "../entities/task";
import type { AudioDraft } from "./audio";

export type PersistedTask = Task & { id: number };

/** What a session is about: the task it was opened from (`id` set) or a free choice of subject and content. */
export type SessionTarget = Pick<Task, "subjectId" | "linkType" | "itemId" | "collectionId" | "title" | "plan"> & { id?: number };

export type SessionLogInput = Pick<Session, "date" | "notes" | "marks"> & {
  helpText?: string;
  clips?: AudioDraft[];
};

export interface SessionLogTransaction {
  createSession(session: Omit<Session, "id">): Promise<number>;
  /** Re-derives `done` from the cumulative section coverage of the task's sessions. */
  syncTaskDone(taskId: number): Promise<void>;
  createRecording(recording: Omit<Recording, "id">): Promise<void>;
  createHelpRequest(request: { sessionId: number; taskId?: number; itemId?: number; question: string; createdAt: number }): Promise<void>;
}

export interface SessionPort {
  list(): Promise<Session[]>;
  byTask(taskId: number): Promise<Session[]>;
  log(task: Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">): Promise<number>;
  update(id: number, patch: Partial<Session>): Promise<void>;
  buildSnapshot(target: SessionTarget): Promise<SessionSnapshot>;
  transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>): Promise<T>;
  remove(id: number): Promise<void>;
  deleteWithTaskReset(sessionId: number, taskId?: number): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
}
