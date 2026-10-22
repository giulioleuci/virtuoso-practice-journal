import type { Task } from "@/domain/entities/task";
import type { TaskPort } from "@/domain/ports/task";
export class UpdateTaskUseCase {
  constructor(private readonly tasks: TaskPort, private readonly clock: () => number = Date.now) {}
  update(id: number, patch: Partial<Task>) { return this.tasks.update(id, patch); }
  async carryOver(task: Task, toDate: string): Promise<number> {
    return this.tasks.carryOver({ ...task,createdAt: this.clock() },toDate);
  }
}
