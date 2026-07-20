import { application, taskRepository, type NewTaskInput } from "@/infrastructure/compositionRoot";
export type { NewTaskInput } from "@/infrastructure/repositories/dexie/taskRepository";
export const tasksService = {
  ...taskRepository,
  create: (input: NewTaskInput) => application.tasks.create.execute(input),
  update: (id: number, patch: Parameters<typeof application.tasks.update.update>[1]) => application.tasks.update.update(id, patch),
  remove: (id: number) => application.tasks.remove.execute(id),
  carryOver: (task: Parameters<typeof application.tasks.update.carryOver>[0], toDate: string) => application.tasks.update.carryOver(task, toDate),
};
