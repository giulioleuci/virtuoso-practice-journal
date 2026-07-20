import type { Task } from "@/domain/entities/task";
import type { TaskPort } from "@/domain/ports/task";
export class UpdateTaskUseCase {
  constructor(private readonly tasks: TaskPort, private readonly clock: () => number = Date.now) {}
  update(id: number, patch: Partial<Task>) { return this.tasks.update(id, patch); }
  async carryOver(task: Task, toDate: string): Promise<number> {
    const { id, date: _date, done: _done, skipped: _skipped, ...rest } = task;
    const newId = await this.tasks.create({ ...rest, date: toDate, done: false, createdAt: this.clock() });
    if (id !== undefined) await this.tasks.skip(id);
    return newId;
  }
}
