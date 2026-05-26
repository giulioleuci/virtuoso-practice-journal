/** Task service — repository wrapper around dexie operations.
 *  Centralizes write paths so UI components don't reach into `db` directly.
 */
import { db, type Task, type TaskRecurrence } from "@/lib/db";
import { expandTaskRecurrence } from "@/lib/recurrence";

export type NewTaskInput = Omit<Task, "id" | "done" | "createdAt" | "date"> & {
  date: string;
  recurrence?: TaskRecurrence;
};

/** Soft-delete a task if it has logged sessions; otherwise hard-delete. */
async function deleteTaskPreservingHistory(taskId: number): Promise<"soft" | "hard"> {
  const hasSession = (await db.sessions.where("taskId").equals(taskId).count()) > 0;
  if (hasSession) {
    await db.tasks.update(taskId, { deletedAt: Date.now() });
    return "soft";
  }
  await db.tasks.delete(taskId);
  return "hard";
}

/** Bulk soft-delete tasks if they have logged sessions; otherwise hard-delete. */
async function deleteTasksPreservingHistory(taskIds: number[]): Promise<{ soft: number; hard: number }> {
  if (!taskIds.length) return { soft: 0, hard: 0 };
  const tasksWithSessions = new Set(await db.sessions.where("taskId").anyOf(taskIds).uniqueKeys() as number[]);

  const softIds: number[] = [];
  const hardIds: number[] = [];
  for (const id of taskIds) {
    if (tasksWithSessions.has(id)) softIds.push(id);
    else hardIds.push(id);
  }

  const now = Date.now();
  await db.transaction("rw", db.tasks, async () => {
    if (softIds.length > 0) {
      await db.tasks.bulkUpdate(softIds.map((id) => ({ key: id, changes: { deletedAt: now } })));
    }
    if (hardIds.length > 0) {
      await db.tasks.bulkDelete(hardIds);
    }
  });

  return { soft: softIds.length, hard: hardIds.length };
}

export const tasksService = {
  async list(): Promise<Task[]> {
    return db.tasks.filter((t) => !t.deletedAt).toArray();
  },

  async byDate(date: string): Promise<Task[]> {
    return db.tasks.where("date").equals(date).filter((t) => !t.deletedAt).toArray();
  },

  async create(input: NewTaskInput): Promise<number> {
    const now = Date.now();
    const { recurrence, ...rest } = input;
    if (!recurrence) {
      return (await db.tasks.add({ ...rest, done: false, createdAt: now })) as number;
    }
    const dates = expandTaskRecurrence(recurrence);
    if (!dates.length) throw new Error("Recurrence produced no dates");
    let firstId = 0;
    await db.transaction("rw", db.tasks, async () => {
      firstId = (await db.tasks.add({
        ...rest,
        date: dates[0],
        recurrence,
        done: false,
        createdAt: now,
      })) as number;
      if (dates.length > 1) {
        await db.tasks.bulkAdd(
          dates.slice(1).map((d) => ({
            ...rest,
            date: d,
            done: false,
            recurrenceTaskId: firstId,
            createdAt: now,
          })),
        );
      }
    });
    return firstId;
  },

  async update(id: number, patch: Partial<Task>): Promise<void> {
    await db.tasks.update(id, patch);
  },

  async toggleDone(id: number, done: boolean): Promise<void> {
    await db.tasks.update(id, { done });
  },

  async removeSeries(rootId: number): Promise<{ soft: number; hard: number }> {
    const children = (await db.tasks.where("recurrenceTaskId").equals(rootId).primaryKeys()) as number[];
    return deleteTasksPreservingHistory([rootId, ...children]);
  },

  async skip(id: number): Promise<void> {
    await db.tasks.update(id, { skipped: true });
  },

  async unskip(id: number): Promise<void> {
    await db.tasks.update(id, { skipped: false });
  },

  async carryOver(task: Task, toDate: string): Promise<number> {
    const { id, date, done, skipped, ...rest } = task;
    const newId = (await db.tasks.add({ ...rest, date: toDate, done: false, createdAt: Date.now() })) as number;
    await db.tasks.update(id!, { skipped: true });
    return newId;
  },

  async bulkSetDone(ids: number[], done: boolean): Promise<void> {
    await db.tasks.bulkUpdate(ids.map((id) => ({ key: id, changes: { done } })));
  },

  async remove(id: number): Promise<"soft" | "hard"> {
    return deleteTaskPreservingHistory(id);
  },

  async bulkRemove(ids: number[]): Promise<{ soft: number; hard: number }> {
    return deleteTasksPreservingHistory(ids);
  },
};
