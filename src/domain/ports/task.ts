import type { Task } from "../entities/task";

export interface TaskPort {
  list(): Promise<Task[]>;
  byDate(date: string): Promise<Task[]>;
  create(task: Omit<Task, "id" | "done" | "createdAt" | "date"> & Pick<Task, "date">): Promise<number>;
  update(id: number, patch: Partial<Task>): Promise<void>;
  remove(id: number): Promise<"soft" | "hard">;
  carryOver(task: Task, toDate: string): Promise<number>;
}
