import { db } from "@/infrastructure/dexie/db";
import type { Task, TaskRecurrence } from "@/domain/entities/task";
import type { NewTaskInput, TaskPort } from "@/domain/ports/task";
import { planCovered } from "@/domain/logic/plan";
import { now } from "@/lib/date";
import { expandTaskRecurrence } from "@/lib/recurrence";

export type { NewTaskInput } from "@/domain/ports/task";
const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;
async function removeMany(ids: number[]) {
  if (!ids.length) return { soft: 0, hard: 0 };
  const withSessions = new Set(await db.sessions.where("taskId").anyOf(ids).uniqueKeys() as number[]);
  const softIds = ids.filter((id) => withSessions.has(id));
  const hardIds = ids.filter((id) => !withSessions.has(id));
  await db.transaction("rw", db.tasks, async () => {
    if (softIds.length) await db.tasks.bulkUpdate(softIds.map((key) => ({ key, changes: { deletedAt: now() } })));
    if (hardIds.length) await db.tasks.bulkDelete(hardIds);
  });
  return { soft: softIds.length, hard: hardIds.length };
}
export const taskRepository = {
  list: () => db.tasks.filter(active).toArray(),
  byDate: (date: string) => db.tasks.where("date").equals(date).filter(active).toArray(),
  async create(input: NewTaskInput) {
    const ts = now(); const { recurrence, ...rest } = input;
    if (!recurrence) return db.tasks.add({ ...rest, done: false, createdAt: ts }) as Promise<number>;
    const dates = expandTaskRecurrence(recurrence); if (!dates.length) throw new Error("Recurrence produced no dates");
    let firstId = 0;
    await db.transaction("rw", db.tasks, async () => { firstId = await db.tasks.add({ ...rest, date: dates[0], recurrence, done: false, createdAt: ts }) as number; if (dates.length > 1) await db.tasks.bulkAdd(dates.slice(1).map((date) => ({ ...rest, date, done: false, recurrenceTaskId: firstId, createdAt: ts }))); });
    return firstId;
  },
  async createRecurring(first: Omit<Task, "id">, followUps: Omit<Task, "id">[]) {
    let id = 0;
    await db.transaction("rw", db.tasks, async () => {
      id = await db.tasks.add(first) as number;
      if (followUps.length) await db.tasks.bulkAdd(followUps.map((task) => ({ ...task, recurrenceTaskId: id })));
    });
    return id;
  },
  async update(id: number, patch: Partial<Task>) {
    await db.transaction("rw", db.tasks, db.sessions, async () => {
      await db.tasks.update(id, patch);
      // Sections added to an already logged plan need their own coverage.
      if (!patch.plan) return;
      const sessions = await db.sessions.where("taskId").equals(id).toArray();
      if (sessions.length) await db.tasks.update(id, { done: planCovered(patch.plan, sessions) });
    });
  },
  toggleDone: async (id: number, done: boolean) => { await db.tasks.update(id, { done }); },
  async remove(id: number) { const result = await removeMany([id]); return result.soft ? "soft" as const : "hard" as const; },
  bulkRemove: removeMany,
  async removeSeries(rootId: number) { return removeMany([rootId, ...(await db.tasks.where("recurrenceTaskId").equals(rootId).primaryKeys() as number[])]); },
  skip: async (id: number) => { await db.tasks.update(id, { skipped: true }); },
  unskip: async (id: number) => { await db.tasks.update(id, { skipped: false }); },
  async carryOver(task: Task, toDate: string) { const { id: _id, date: _date, done: _done, skipped: _skipped, ...rest } = task; const newId = await db.tasks.add({ ...rest, date: toDate, done: false, createdAt: now() }) as number; await db.tasks.update(task.id!, { skipped: true }); return newId; },
  bulkSetDone: async (ids: number[], done: boolean) => { await db.tasks.bulkUpdate(ids.map((key) => ({ key, changes: { done } }))); },
  hasSessions: async (id: number) => (await db.sessions.where("taskId").equals(id).count()) > 0,
  hardDelete: async (id: number) => { await db.tasks.delete(id); },
  restore: async (task: Task) => { await db.tasks.add(task); },
} satisfies TaskPort;
