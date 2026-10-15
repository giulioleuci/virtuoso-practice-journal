import { db } from "@/infrastructure/dexie/db";
import type { Lesson, LessonRecurrence } from "@/domain/entities/lesson";
import { now } from "@/lib/date";
import type { LessonPort } from "@/domain/ports/lesson";
export async function buildDexieLessonSnapshot(subjectId: number, recurrence: LessonRecurrence | null | undefined, piecePlayedIds: number[] = []) { const [subject, pieces] = await Promise.all([db.subjects.get(subjectId), piecePlayedIds.length ? db.library.where("id").anyOf(piecePlayedIds).toArray() : []]); return { snapshot: { subjectName: subject?.name ?? "—", teacher: recurrence?.teacher, frequency: recurrence?.schedules?.[0]?.frequency }, piecesPlayedTitles: pieces.map((piece) => piece.title) }; }
export const lessonRepository = {
  list: () => db.lessons.toArray(), get: (id: number) => db.lessons.get(id), listRecurrences: () => db.recurrences.toArray(),
  upsertRecurrence: async (data: Omit<LessonRecurrence, "id">, id?: number) => { if (id) { await db.recurrences.put({ ...data, id }); return id; } return db.recurrences.add(data) as Promise<number>; }, deleteRecurrence: async (id: number) => { await db.recurrences.delete(id); },
  async ensureFor(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string) {
    const existing = await db.lessons.where("date").equals(date).and((lesson) => lesson.subjectId === subjectId && lesson.recurrenceId === recurrence?.id).first();
    if (existing) return existing.id!;
    const { snapshot, piecesPlayedTitles } = await buildDexieLessonSnapshot(subjectId, recurrence);
    return db.lessons.add({ recurrenceId: recurrence?.id, subjectId, date, piecesPlayed: [], snapshot, piecesPlayedTitles, createdAt: now() }) as Promise<number>;
  },
  async log(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string, notes: string | undefined, assignmentTexts: string[] = []) {
    const id = await lessonRepository.ensureFor(subjectId, recurrence, date);
    await db.lessons.update(id, { notes: notes?.trim() || undefined });
    for (const text of assignmentTexts) await lessonRepository.addAssignment(id, text);
    return id;
  },
  async updateLesson(lesson: Lesson, date: string, notes: string | undefined) { await db.lessons.put({ ...lesson, date, notes: notes?.trim() || undefined }); },
  async addAssignment(lessonId: number, text: string) { const trimmed = text.trim(); return trimmed ? db.assignments.add({ lessonId, text: trimmed, taskIds: [], createdAt: now() }) as Promise<number> : 0; },
  async updateAssignment(id: number, text: string) { const trimmed = text.trim(); if (trimmed) await db.assignments.update(id, { text: trimmed }); },
  removeAssignment: async (id: number) => { await db.assignments.delete(id); },
  async deleteLesson(id: number) { await db.transaction("rw", db.lessons, db.assignments, async () => { await db.assignments.where("lessonId").equals(id).delete(); await db.lessons.delete(id); }); },
  update: async (id: number, patch: Partial<Lesson>) => { await db.lessons.update(id, patch); },
  remove: async (id: number) => { await db.transaction("rw", db.lessons, db.assignments, async () => { await db.assignments.where("lessonId").equals(id).delete(); await db.lessons.delete(id); }); },
  assignmentsForLesson: (lessonId: number) => db.assignments.where("lessonId").equals(lessonId).toArray(),
  ignoreAssignment: async (id: number) => { await db.assignments.update(id, { ignored: true }); },
  restoreAssignment: async (id: number) => { await db.assignments.update(id, { ignored: false }); },
  async linkTask(id: number, taskId: number) { await db.assignments.where("id").equals(id).modify((a) => { if (!a.taskIds.includes(taskId)) a.taskIds.push(taskId); }); },
  async unlinkTask(id: number, taskId: number) { await db.assignments.where("id").equals(id).modify((a) => { a.taskIds = a.taskIds.filter((t) => t !== taskId); }); },
} satisfies LessonPort;
