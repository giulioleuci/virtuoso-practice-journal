import type { TaskPort } from "@/domain/ports/task";
export class RemoveTaskUseCase {
  constructor(private readonly tasks: TaskPort, private readonly clock: () => number = Date.now) {}
  async execute(id: number): Promise<"soft" | "hard"> {
    if (await this.tasks.hasSessions(id)) { await this.tasks.update(id, { deletedAt: this.clock() }); return "soft"; }
    await this.tasks.hardDelete(id); return "hard";
  }
}
