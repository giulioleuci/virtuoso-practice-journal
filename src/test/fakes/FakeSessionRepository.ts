import type { Session } from "@/domain/entities/session";
import type { PersistedTask, SessionLogInput, SessionPort } from "@/domain/ports/session";
import { FakeTaskRepository } from "./FakeTaskRepository";

export class FakeSessionRepository implements SessionPort {
  sessions: Session[];
  helpRequests: { sessionId: number; taskId: number; question: string }[] = [];
  constructor(private readonly tasks: FakeTaskRepository, sessions: Session[] = []) { this.sessions = sessions; }
  async list() { return this.sessions; }
  async byTask(taskId: number) { return this.sessions.filter((session) => session.taskId === taskId); }
  async log(task: PersistedTask, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">) { return this.logWithCompletion(task, { ...input, date }); }
  async update(id: number, patch: Partial<Session>) { const session = this.sessions.find((row) => row.id === id); if (session) Object.assign(session, patch); }
  async logWithCompletion(task: PersistedTask, input: SessionLogInput) {
    const id = this.sessions.length + 1;
    this.sessions.push({ id, taskId: task.id, date: input.date, confidence: input.confidence, snapshot: { taskTitle: task.title, subjectName: "—" }, createdAt: 0 });
    await this.tasks.update(task.id, { done: true });
    if (input.helpText) this.helpRequests.push({ sessionId: id, taskId: task.id, question: input.helpText });
    return id;
  }
  async remove(id: number) { this.sessions = this.sessions.filter((session) => session.id !== id); }
  async deleteWithTaskReset(id: number, taskId?: number) { await this.remove(id); if (taskId && !(await this.byTask(taskId)).length) await this.tasks.update(taskId, { done: false }); }
  async deleteByTaskAndDate(taskId: number, date: string) { this.sessions = this.sessions.filter((session) => session.taskId !== taskId || session.date !== date); await this.tasks.update(taskId, { done: false }); }
}
