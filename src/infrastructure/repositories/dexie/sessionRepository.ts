import { db } from "@/infrastructure/dexie/db";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { SessionPort } from "@/domain/ports/session";
import { now } from "@/lib/date";
export async function buildDexieSessionSnapshot(task: Task) { const [subject, item, segments, techniques, collection] = await Promise.all([db.subjects.get(task.subjectId), task.itemId ? db.library.get(task.itemId) : undefined, task.segmentIds?.length ? db.segments.where("id").anyOf(task.segmentIds).toArray() : [], task.techniqueIds?.length ? db.techniques.where("id").anyOf(task.techniqueIds).toArray() : [], task.collectionId ? db.collections.get(task.collectionId) : undefined]); return { taskTitle: task.title, subjectName: subject?.name ?? "—", itemTitle: item?.title, itemComposer: item?.composer, segments: segments.length ? segments.map((segment) => ({ id: String(segment.id), label: segment.label })) : undefined, collectionName: collection?.name, targetBpm: task.targetBpm, noteVal: task.noteVal, layers: task.layers, techniqueNames: techniques.map((technique) => technique.name) }; }
export const sessionRepository = {
  list: () => db.sessions.toArray(), byTask: (taskId: number) => db.sessions.where("taskId").equals(taskId).toArray(),
  async log(task: Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">) { return db.sessions.add({ taskId: task.id!, date, ...input, snapshot: await buildDexieSessionSnapshot(task), createdAt: now() }) as Promise<number>; },
  update: async (id: number, patch: Partial<Session>) => { await db.sessions.update(id, patch); }, remove: async (id: number) => { await db.sessions.delete(id); },
  buildSnapshot: buildDexieSessionSnapshot,
  transaction<T>(operation: (transaction: import("@/domain/ports/session").SessionLogTransaction) => Promise<T>) {
    return db.transaction("rw", db.tasks, db.sessions, db.helpRequests, () => operation({
      createSession: (session) => db.sessions.add(session) as Promise<number>,
      completeTask: async (taskId) => { await db.tasks.update(taskId, { done: true }); },
      createHelpRequest: async (request) => { await db.helpRequests.add({ ...request, resolved: false }); },
    }));
  },
  async deleteWithTaskReset(id: number, taskId?: number) { await db.transaction("rw", db.tasks, db.sessions, async () => { await db.sessions.delete(id); if (taskId && await db.sessions.where("taskId").equals(taskId).count() === 0) await db.tasks.update(taskId, { done: false }); }); },
  async deleteByTaskAndDate(taskId: number, date: string) { await db.transaction("rw", db.tasks, db.sessions, async () => { const rows = await db.sessions.where("taskId").equals(taskId).and((session) => session.date === date).toArray(); await db.sessions.bulkDelete(rows.map((row) => row.id)); await db.tasks.update(taskId, { done: false }); }); },
} satisfies SessionPort;
