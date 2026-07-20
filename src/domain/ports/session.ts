import type { Session, SessionSnapshot } from "../entities/session";
import type { Task } from "../entities/task";

export type PersistedTask = Task & { id: number };

export type SessionLogInput = Omit<Session, "id" | "taskId" | "snapshot" | "createdAt"> & {
  date: string;
  helpText?: string;
};

export interface SessionLogTransaction {
  createSession(session: Omit<Session, "id">): Promise<number>;
  completeTask(taskId: number): Promise<void>;
  createHelpRequest(request: { sessionId: number; taskId: number; itemId?: number; question: string; createdAt: number }): Promise<void>;
}

export interface SessionPort {
  list(): Promise<Session[]>;
  byTask(taskId: number): Promise<Session[]>;
  log(task: Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">): Promise<number>;
  update(id: number, patch: Partial<Session>): Promise<void>;
  buildSnapshot(task: Task): Promise<SessionSnapshot>;
  transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>): Promise<T>;
  remove(id: number): Promise<void>;
  deleteWithTaskReset(sessionId: number, taskId?: number): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
}
