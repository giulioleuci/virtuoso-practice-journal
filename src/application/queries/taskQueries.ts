import type { Task } from "@/domain/entities/task";
import type { TaskPort } from "@/domain/ports/task";
export type TaskDto = Task;
export interface TaskQueries { active(): Promise<TaskDto[]>; byDate(date: string): Promise<TaskDto[]>; inRange(from: string, to: string): Promise<TaskDto[]>; byItem(itemId: number): Promise<TaskDto[]>; }
export const taskQueries = (tasks: TaskPort): TaskQueries => ({
  active: async () => (await tasks.list()).filter((task) => !task.deletedAt),
  byDate: async (date) => (await tasks.byDate(date)).filter((task) => !task.deletedAt),
  inRange: async (from, to) => (await tasks.list()).filter((task) => !task.deletedAt && task.date >= from && task.date <= to),
  byItem: async (itemId) => (await tasks.list()).filter((task) => task.itemId === itemId),
});
