/** Session service — wraps reads/writes for practice sessions. */
import { db, type NoteVal, type SegmentMetric, type Session, type SessionQuality, type Task } from "@/lib/db";
import { buildSessionSnapshot } from "@/lib/domain/snapshots";
import type { SessionInput } from "@/lib/schemas";

export interface FullSessionLogInput {
  date: string;
  bpmReached?: number;
  noteVal?: NoteVal;
  reps?: number;
  confidence?: number;
  quality?: SessionQuality;
  notes?: string;
  layersUsed: string[];
  techniquesUsed: number[];
  layerScores?: Record<string, number>;
  techniqueScores?: Record<number, number>;
  segmentMetrics?: Record<string, SegmentMetric>;
  helpText?: string;
}

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

  async logWithCompletion(task: Task, input: FullSessionLogInput): Promise<number> {
    const snapshot = await buildSessionSnapshot({
      ...task,
      layers: input.layersUsed,
      techniqueIds: input.techniquesUsed,
      targetBpm: input.bpmReached ?? task.targetBpm,
      noteVal: input.noteVal ?? task.noteVal,
    });
    const now = Date.now();
    let sessionId = 0;
    await db.transaction("rw", db.tasks, db.sessions, db.helpRequests, async () => {
      sessionId = (await db.sessions.add({
        taskId: task.id!,
        date: input.date,
        bpmReached: input.bpmReached,
        noteVal: input.noteVal,
        reps: input.reps,
        confidence: input.confidence,
        quality: input.quality,
        notes: input.notes?.trim() || undefined,
        layersUsed: input.layersUsed,
        techniquesUsed: input.techniquesUsed,
        layerScores: input.layerScores,
        techniqueScores: input.techniqueScores,
        segmentMetrics: input.segmentMetrics,
        snapshot,
        createdAt: now,
      })) as number;
      await db.tasks.update(task.id!, { done: true });
      if (input.helpText) {
        await db.helpRequests.add({
          sessionId,
          taskId: task.id!,
          itemId: task.itemId,
          question: input.helpText,
          resolved: false,
          createdAt: now,
        });
      }
    });
    return sessionId;
  },

  async deleteWithTaskReset(sessionId: number, taskId?: number): Promise<void> {
    await db.sessions.delete(sessionId);
    if (taskId) {
      const remaining = await db.sessions.where("taskId").equals(taskId).count();
      if (remaining === 0) await db.tasks.update(taskId, { done: false });
    }
  },

  async deleteByTaskAndDate(taskId: number, date: string): Promise<void> {
    const sessions = await db.sessions
      .where("taskId")
      .equals(taskId)
      .and((s) => s.date === date)
      .toArray();
    await db.sessions.bulkDelete(sessions.map((s) => s.id!).filter(Boolean) as number[]);
    await db.tasks.update(taskId, { done: false });
  },
};
