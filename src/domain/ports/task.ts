import type { Task, TaskRecurrence } from "../entities/task";

export type NewTaskInput = Omit<Task, "id" | "done" | "createdAt" | "date"> & {
  date: string;
  recurrence?: TaskRecurrence;
};

export interface TaskPort {
  list(): Promise<Task[]>;
  byDate(date: string): Promise<Task[]>;
  create(task: NewTaskInput): Promise<number>;
  update(id: number, patch: Partial<Task>): Promise<void>;
  remove(id: number): Promise<"soft" | "hard">;
  carryOver(task: Task, toDate: string): Promise<number>;
  toggleDone(id: number, done: boolean): Promise<void>;
  bulkRemove(ids: number[]): Promise<{ soft: number; hard: number }>;
  removeSeries(rootId: number): Promise<{ soft: number; hard: number }>;
  skip(id: number): Promise<void>;
  unskip(id: number): Promise<void>;
  bulkSetDone(ids: number[], done: boolean): Promise<void>;
  findOrCreateForLog(options: { date: string; subjectId: number; itemId?: number; fallbackItemTitle: string; freeTitle: string }): Promise<Task | undefined>;
  hasSessions(id: number): Promise<boolean>;
  hardDelete(id: number): Promise<void>;
  restore(task: Task): Promise<void>;
}
