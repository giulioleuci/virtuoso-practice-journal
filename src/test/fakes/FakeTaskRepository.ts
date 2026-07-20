import type { Task } from "@/domain/entities/task";
import type { NewTaskInput, TaskPort } from "@/domain/ports/task";

export class FakeTaskRepository implements TaskPort {
  created: Omit<Task, "id">[] = [];
  createRecurringCalls = 0;
  updated = new Map<number, Partial<Task>>();
  deleted: number[] = [];
  sessionTaskIds = new Set<number>();
  constructor(private readonly rows: Task[] = []) {}
  async list() { return this.rows.filter((task) => !task.deletedAt); }
  async byDate(date: string) { return (await this.list()).filter((task) => task.date === date); }
  async create(task: NewTaskInput) { const id = this.rows.length + this.created.length + 1; this.created.push({ ...task, done: false, createdAt: task.createdAt ?? 0 }); return id; }
  async createRecurring(first: Omit<Task, "id">, followUps: Omit<Task, "id">[]) {
    this.createRecurringCalls++;
    const id = this.rows.length + this.created.length + 1;
    this.created.push(first, ...followUps.map((task) => ({ ...task, recurrenceTaskId: id })));
    return id;
  }
  async update(id: number, patch: Partial<Task>) { this.updated.set(id, patch); }
  async remove(id: number) { return this.sessionTaskIds.has(id) ? "soft" as const : "hard" as const; }
  async carryOver(task: Task, toDate: string) { const id = await this.create({ ...task, date: toDate }); if (task.id) await this.skip(task.id); return id; }
  async toggleDone(id: number, done: boolean) { await this.update(id, { done }); }
  async bulkRemove(ids: number[]) { return { soft: ids.filter((id) => this.sessionTaskIds.has(id)).length, hard: ids.filter((id) => !this.sessionTaskIds.has(id)).length }; }
  async removeSeries(id: number) { return this.bulkRemove([id]); }
  async skip(id: number) { await this.update(id, { skipped: true }); }
  async unskip(id: number) { await this.update(id, { skipped: false }); }
  async bulkSetDone(ids: number[], done: boolean) { await Promise.all(ids.map((id) => this.toggleDone(id, done))); }
  async findOrCreateForLog() { return undefined; }
  async hasSessions(id: number) { return this.sessionTaskIds.has(id); }
  async hardDelete(id: number) { this.deleted.push(id); }
  async restore(task: Task) { this.rows.push(task); }
}
