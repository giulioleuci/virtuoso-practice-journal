/** Session service — wraps reads/writes for practice sessions. */
import { buildSessionSnapshot, db, type Session, type Task } from "@/lib/db";
import type { SessionInput } from "@/lib/schemas";

export const sessionsService = {
  async list(): Promise<Session[]> {
    return db.sessions.toArray();
  },

  async byTask(taskId: number): Promise<Session[]> {
    return db.sessions.where("taskId").equals(taskId).toArray();
  },

  async log(task: Task, date: string, input: SessionInput): Promise<number> {
    const snapshot = await buildSessionSnapshot(task);
    const id = (await db.sessions.add({
      taskId: task.id!,
      date,
      ...input,
      snapshot,
      createdAt: Date.now(),
    })) as number;
    return id;
  },

  async update(id: number, patch: Partial<Session>): Promise<void> {
    await db.sessions.update(id, patch);
  },

  async remove(id: number): Promise<void> {
    await db.sessions.delete(id);
  },
};
