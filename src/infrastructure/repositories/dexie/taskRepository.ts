import { tempoProgressionRepository } from "./tempoProgressionRepository";
import { inheritTempoProgressions, tempoOwner } from "@/domain/logic/tempoProgression";
import { tempoRuleSchema } from "@/lib/schemas";
import { db } from "@/infrastructure/dexie/db";
import type { Task, TaskRecurrence } from "@/domain/entities/task";
import type { NewTaskInput, TaskPort } from "@/domain/ports/task";
import { planCovered } from "@/domain/logic/plan";
import { now, today } from "@/lib/date";
import { windowedRecurrenceDates } from "@/lib/recurrence";

export type { NewTaskInput } from "@/domain/ports/task";
const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;
async function removeMany(ids: number[]) {
  if (!ids.length) return { soft: 0, hard: 0 };
  const withSessions = new Set(await db.sessions.where("taskId").anyOf(ids).uniqueKeys() as number[]);
  const protectedRoots = new Set((await db.tasks.where("recurrenceTaskId").anyOf(ids).toArray()).filter(t => !ids.includes(t.id!) || withSessions.has(t.id!)).map(t => t.recurrenceTaskId));
  const owners = new Set((await db.tempoProgressions.where("[owner.kind+owner.id]").anyOf(ids.map(id => ["recurrence",id])).toArray()).map(s => s.owner.id));
  const softIds = ids.filter((id) => withSessions.has(id) || protectedRoots.has(id) || owners.has(id));
  const hardIds = ids.filter((id) => !softIds.includes(id));
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
    if (rest.tempoRule) { tempoRuleSchema.parse(rest.tempoRule); if (!recurrence) throw new Error("Tempo rule requires recurrence"); rest.tempoRuleRevision = 1; }
    const { tempoRule: _rule, tempoRuleRevision: _revision, ...child } = rest;
    if (!recurrence) {
      const task = { ...rest, done: false, createdAt: ts }, owner = tempoOwner(task);
      if (!owner || task.customized) return db.tasks.add(task) as Promise<number>;
      return db.transaction("rw", [db.tasks, db.tempoProgressions, db.studyRoutines, db.sessions, db.segments, db.library], async () => {
        const data = await tempoProgressionRepository.read(owner);
        return db.tasks.add(inheritTempoProgressions(task,data.states,data.rule,data.segments)) as Promise<number>;
      });
    }
    const dates = windowedRecurrenceDates(recurrence, undefined, today()); if (!dates.length) throw new Error("Recurrence produced no dates");
    let firstId = 0;
    await db.transaction("rw", db.tasks, async () => { firstId = await db.tasks.add({ ...rest, date: dates[0], recurrence, materializedUntil: dates.at(-1), done: false, createdAt: ts }) as number; if (dates.length > 1) await db.tasks.bulkAdd(dates.slice(1).map((date) => ({ ...child, date, done: false, recurrenceTaskId: firstId, createdAt: ts }))); });
    return firstId;
  },
  async createRecurring(first: Omit<Task, "id">, followUps: Omit<Task, "id">[]) {
    let id = 0;
    await db.transaction("rw", db.tasks, async () => {
      id = await db.tasks.add(first) as number;
      if (followUps.length) await db.tasks.bulkAdd(followUps.map(({ tempoRule: _rule,tempoRuleRevision: _revision,...task }) => ({ ...task, recurrenceTaskId: id })));
    });
    return id;
  },
  async update(id: number, patch: Partial<Task>) {
    await db.transaction("rw", [db.tasks, db.sessions, db.tempoProgressions, db.studyRoutines, db.segments, db.library], async () => {
      const current = await db.tasks.get(id);
      if ("tempoRule" in patch) {
        if (!current || (!current.recurrence && current.recurrenceTaskId === undefined)) throw new Error("Tempo rule requires recurrence");
        await tempoProgressionRepository.configure({ kind: "recurrence", id: current.recurrenceTaskId ?? id },patch.tempoRule,now());
      }
      const { tempoRule: _rule, tempoRuleRevision: _revision, ...fields } = patch;
      await db.tasks.update(id, fields);
      // Importance is a series trait: later undone, untouched occurrences follow it.
      const root = current?.recurrenceTaskId ?? (current?.recurrence ? id : undefined);
      if (current && root !== undefined && fields.importance !== undefined) await db.tasks.where("recurrenceTaskId").equals(root).filter(t => t.date > current.date && !t.done && !t.customized).modify({ importance: fields.importance });
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
  async carryOver(task: Task, toDate: string) {
    return db.transaction("rw", [db.tasks, db.tempoProgressions, db.studyRoutines, db.sessions, db.segments, db.library], async () => {
      const current = task.id === undefined ? task : await db.tasks.get(task.id);
      if (!current) throw new Error("Task disappeared");
      const owner = tempoOwner(current);
      let source = current;
      if (owner && !current.customized) {
        const data = await tempoProgressionRepository.read(owner);
        source = inheritTempoProgressions(current,data.states,data.rule,data.segments);
      }
      const { id, date: _date, done: _done, skipped: _skipped, ...rest } = source;
      const newId = await db.tasks.add({ ...rest, date: toDate, recurrenceTaskId: source.recurrenceTaskId ?? (source.recurrence ? id : undefined), recurrence: undefined, tempoRule: undefined, tempoRuleRevision: undefined, done: false, createdAt: now() }) as number;
      if (id !== undefined) await db.tasks.update(id, { skipped: true });
      return newId;
    });
  },
  bulkSetDone: async (ids: number[], done: boolean) => { await db.tasks.bulkUpdate(ids.map((key) => ({ key, changes: { done } }))); },
  hasSessions: async (id: number) => (await db.sessions.where("taskId").equals(id).count()) > 0,
  hardDelete: async (id: number) => { await removeMany([id]); },
  restore: async (task: Task) => { await db.tasks.add(task); },
} satisfies TaskPort;
