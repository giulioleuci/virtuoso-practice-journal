import { planCovered } from "@/domain/logic/plan";
import type { Session } from "@/domain/entities/session";
import type { SessionLogTransaction, SessionPort } from "@/domain/ports/session";
import { FakeTaskRepository } from "./FakeTaskRepository";

export class FakeSessionRepository implements SessionPort {
  sessions: Session[];
  helpRequests: { sessionId: number; taskId?: number; question: string }[] = [];
  failHelpRequest = false;
  constructor(private readonly tasks: FakeTaskRepository, sessions: Session[] = []) { this.sessions = sessions; }
  private async syncTaskDone(taskId: number) {
    const task = this.tasks.rows.find((row) => row.id === taskId);
    await this.tasks.update(taskId, { done: planCovered(task?.plan ?? [], this.sessions.filter((s) => s.taskId === taskId)) });
  }
  async list() { return this.sessions; }
  async byTask(taskId: number) { return this.sessions.filter((session) => session.taskId === taskId); }
  async log(task: import("@/domain/entities/task").Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">) { const id = this.sessions.length + 1; this.sessions.push({ ...input, id, taskId: task.id!, date, snapshot: await this.buildSnapshot(task), createdAt: 0 }); return id; }
  async update(id: number, patch: Partial<Session>) { const session = this.sessions.find((row) => row.id === id); if (session) Object.assign(session, patch); }
  async buildSnapshot(task: import("@/domain/ports/session").SessionTarget) {
    return { taskTitle: task.title, subjectName: "—", techniqueNames: [...new Set(task.plan.flatMap((entry) => entry.techniques))].map((id) => `technique ${id}`) };
  }
  async transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>) {
    const sessions = [...this.sessions];
    const helps = [...this.helpRequests];
    const updates = new Map(this.tasks.updated);
    try {
      return await operation({
        createSession: async (session) => { const id = this.sessions.length + 1; this.sessions.push({ ...session, id }); return id; },
        syncTaskDone: (taskId) => this.syncTaskDone(taskId),
        createHelpRequest: async (request) => { if (this.failHelpRequest) throw new Error("help persistence failed"); this.helpRequests.push(request); },
      });
    } catch (error) {
      this.sessions = sessions;
      this.helpRequests = helps;
      this.tasks.updated = updates;
      throw error;
    }
  }
  async remove(id: number) { this.sessions = this.sessions.filter((session) => session.id !== id); }
  async deleteWithTaskReset(id: number, taskId?: number) { await this.remove(id); if (taskId !== undefined) await this.syncTaskDone(taskId); }
  async deleteByTaskAndDate(taskId: number, date: string) { this.sessions = this.sessions.filter((session) => session.taskId !== taskId || session.date !== date); await this.tasks.update(taskId, { done: false }); }
}
