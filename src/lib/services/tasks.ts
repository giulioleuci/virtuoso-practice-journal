import { taskRepository, type NewTaskInput } from "@/infrastructure/repositories/dexie/taskRepository";
export type { NewTaskInput } from "@/infrastructure/repositories/dexie/taskRepository";
export const tasksService = taskRepository;
