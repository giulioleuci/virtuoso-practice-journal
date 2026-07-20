import type { Session } from "../entities/session";
import type { Task } from "../entities/task";

export type SessionLogInput = Omit<Session, "id" | "taskId" | "date" | "snapshot" | "createdAt">;

export interface SessionPort {
  list(): Promise<Session[]>;
  byTask(taskId: number): Promise<Session[]>;
  log(task: Task, date: string, input: SessionLogInput): Promise<number>;
  remove(id: number): Promise<void>;
  deleteWithTaskReset(sessionId: number, taskId?: number): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
}
