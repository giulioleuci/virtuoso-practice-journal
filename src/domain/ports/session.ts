import type { Session } from "../entities/session";
import type { Task } from "../entities/task";

export type PersistedTask = Task & { id: number };

export type SessionLogInput = Omit<Session, "id" | "taskId" | "snapshot" | "createdAt"> & {
  date: string;
  helpText?: string;
};

export interface SessionPort {
  list(): Promise<Session[]>;
  byTask(taskId: number): Promise<Session[]>;
  log(task: Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">): Promise<number>;
  update(id: number, patch: Partial<Session>): Promise<void>;
  logWithCompletion(task: PersistedTask, input: SessionLogInput): Promise<number>;
  remove(id: number): Promise<void>;
  deleteWithTaskReset(sessionId: number, taskId?: number): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
}
