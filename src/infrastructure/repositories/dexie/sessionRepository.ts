import { db } from "@/infrastructure/dexie/db";
import { browserAudio } from "@/infrastructure/audio/browserAudio";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import type { SessionLogTransaction, SessionPort, SessionTarget } from "@/domain/ports/session";
import { planCovered, planSegmentIds } from "@/domain/logic/plan";
import { now } from "@/lib/date";
export async function buildDexieSessionSnapshot(task: SessionTarget) {
  const segmentIds = planSegmentIds(task.plan);
  const techniqueIds = [...new Set(task.plan.flatMap((entry) => entry.techniques))];
  const [subject, item, segments, techniques, collection] = await Promise.all([
    db.subjects.get(task.subjectId),
    task.itemId ? db.library.get(task.itemId) : undefined,
    segmentIds.length ? db.segments.where("id").anyOf(segmentIds).toArray() : [],
    techniqueIds.length ? db.techniques.where("id").anyOf(techniqueIds).toArray() : [],
    task.collectionId ? db.collections.get(task.collectionId) : undefined,
  ]);
  return {
    taskTitle: task.title,
    subjectName: subject?.name ?? "—",
    itemTitle: item?.title,
    itemComposer: item?.composer,
    segments: segments.length ? segments.map((segment) => ({ id: String(segment.id), label: segment.label, barStart: segment.barStart, barEnd: segment.barEnd })) : undefined,
    collectionName: collection?.name,
    techniqueNames: techniques.map((technique) => technique.name),
  };
}
/** Completion follows the sections covered by all of the task's sessions. Call inside a rw transaction on tasks + sessions. */
async function syncTaskDone(taskId: number) {
  const [task, sessions] = await Promise.all([db.tasks.get(taskId), db.sessions.where("taskId").equals(taskId).toArray()]);
  if (task) await db.tasks.update(taskId, { done: planCovered(task.plan, sessions) });
}
export const sessionRepository = {
  list: () => db.sessions.toArray(), byTask: (taskId: number) => db.sessions.where("taskId").equals(taskId).toArray(),
  async log(task: Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">) { return db.sessions.add({ taskId: task.id!, date, ...input, snapshot: await buildDexieSessionSnapshot(task), createdAt: now() }) as Promise<number>; },
  async update(id: number, patch: Partial<Session>) {
    await db.transaction("rw", db.tasks, db.sessions, async () => {
      await db.sessions.update(id, patch);
      const taskId = (await db.sessions.get(id))?.taskId;
      if (patch.marks && taskId !== undefined) await syncTaskDone(taskId);
    });
  },
  remove: async (id: number) => { await db.sessions.delete(id); },
  buildSnapshot: buildDexieSessionSnapshot,
  transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>) {
    return db.transaction("rw", db.tasks, db.sessions, db.helpRequests, db.recordings, () => operation({
      createSession: (session) => db.sessions.add(session) as Promise<number>,
      createRecording: async (recording) => { await db.recordings.add(recording); },
      syncTaskDone,
      createHelpRequest: async (request) => { await db.helpRequests.add({ ...request, resolved: false }); },
    }));
  },
  async deleteWithTaskReset(id: number, taskId?: number) {
    const clips = await db.transaction("rw", db.tasks, db.sessions, db.recordings, async () => {
      const rows = await db.recordings.where("sessionId").equals(id).toArray();
      await db.recordings.bulkDelete(rows.flatMap((row) => (row.id === undefined ? [] : [row.id])));
      await db.sessions.delete(id);
      if (taskId !== undefined) await syncTaskDone(taskId);
      return rows;
    });
    await browserAudio.discard(clips.map((clip) => clip.uid));
  },
  async deleteByTaskAndDate(taskId: number, date: string) { await db.transaction("rw", db.tasks, db.sessions, async () => { const rows = await db.sessions.where("taskId").equals(taskId).and((session) => session.date === date).toArray(); await db.sessions.bulkDelete(rows.map((row) => row.id)); await db.tasks.update(taskId, { done: false }); }); },
} satisfies SessionPort;
