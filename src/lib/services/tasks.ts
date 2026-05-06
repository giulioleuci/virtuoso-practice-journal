/** Task service — repository wrapper around dexie operations.
 *  Centralizes write paths so UI components don't reach into `db` directly.
 */
import { db, deleteTaskPreservingHistory, type Task, type TaskRecurrence } from "@/lib/db";
import { expandTaskRecurrence } from "@/lib/recurrence";

export type NewTaskInput = Omit<Task, "id" | "done" | "createdAt" | "date"> & {
  date: string;
  recurrence?: TaskRecurrence;
};

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

  async remove(id: number): Promise<"soft" | "hard"> {
    return deleteTaskPreservingHistory(id);
  },

  async bulkRemove(ids: number[]): Promise<{ soft: number; hard: number }> {
    let soft = 0;
    let hard = 0;
    for (const id of ids) {
      const mode = await deleteTaskPreservingHistory(id);
      if (mode === "soft") soft++;
      else hard++;
    }
    return { soft, hard };
  },
};
