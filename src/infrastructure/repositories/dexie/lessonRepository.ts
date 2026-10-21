import { db } from "@/infrastructure/dexie/db";
import { lessonNotes, type Assignment, type Lesson, type LessonNote, type LessonRecurrence } from "@/domain/entities/lesson";
import { now } from "@/lib/date";
import type { LessonPort } from "@/domain/ports/lesson";
export async function buildDexieLessonSnapshot(subjectId: number, recurrence: LessonRecurrence | null | undefined, piecePlayedIds: number[] = []) { const [subject, pieces] = await Promise.all([db.subjects.get(subjectId), piecePlayedIds.length ? db.library.where("id").anyOf(piecePlayedIds).toArray() : []]); return { snapshot: { subjectName: subject?.name ?? "—", teacher: recurrence?.teacher, frequency: recurrence?.schedules?.[0]?.frequency }, piecesPlayedTitles: pieces.map((piece) => piece.title) }; }
const findSlot = (subjectId: number, recurrenceId: number | undefined, date: string) => db.lessons.where("date").equals(date).and((lesson) => lesson.subjectId === subjectId && lesson.recurrenceId === recurrenceId).first();
export const lessonRepository = {
  list: () => db.lessons.toArray(), get: (id: number) => db.lessons.get(id), listRecurrences: () => db.recurrences.toArray(),
  upsertRecurrence: async (data: Omit<LessonRecurrence, "id">, id?: number) => { if (id) { await db.recurrences.put({ ...data, id }); return id; } return db.recurrences.add(data) as Promise<number>; }, deleteRecurrence: async (id: number) => { await db.recurrences.delete(id); },
  async ensureFor(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string) {
    return db.transaction("rw", db.lessons, db.subjects, db.library, async () => {
      const existing = await findSlot(subjectId, recurrence?.id, date);
      if (existing) return existing.id!;
      const { snapshot, piecesPlayedTitles } = await buildDexieLessonSnapshot(subjectId, recurrence);
      return db.lessons.add({ recurrenceId: recurrence?.id, subjectId, date, piecesPlayed: [], snapshot, piecesPlayedTitles, createdAt: now() }) as Promise<number>;
    });
  },
  async log(subjectId: number, recurrence: LessonRecurrence | null | undefined, date: string, assignmentTexts: string[] = []) {
    const id = await lessonRepository.ensureFor(subjectId, recurrence, date);
    for (const text of assignmentTexts) await lessonRepository.addAssignment(id, text);
    return id;
  },
  async addNote(lessonId: number, text: string) { const trimmed = text.trim(); if (!trimmed) return ""; const id = crypto.randomUUID(); await db.lessons.where("id").equals(lessonId).modify((l) => { l.notes = [...lessonNotes(l), { id, text: trimmed }]; }); return id; },
  async updateNote(lessonId: number, noteId: string, text: string) { const trimmed = text.trim(); if (trimmed) await db.lessons.where("id").equals(lessonId).modify((l) => { l.notes = lessonNotes(l).map((n) => (n.id === noteId ? { ...n, text: trimmed } : n)); }); },
  async removeNote(lessonId: number, noteId: string) { await db.lessons.where("id").equals(lessonId).modify((l) => { l.notes = lessonNotes(l).filter((n) => n.id !== noteId); }); },
  async reinsertNote(lessonId: number, note: LessonNote, index: number) { await db.lessons.where("id").equals(lessonId).modify((l) => { const notes = [...lessonNotes(l)]; if (!notes.some((n) => n.id === note.id)) notes.splice(index, 0, note); l.notes = notes; }); },
  async setDate(lessonId: number, date: string) {
    await db.transaction("rw", db.lessons, async () => {
      const lesson = await db.lessons.get(lessonId);
      if (!lesson) return;
      const clash = await findSlot(lesson.subjectId, lesson.recurrenceId, date);
      if (clash && clash.id !== lessonId) throw new Error("lesson-exists");
      await db.lessons.update(lessonId, { date });
    });
  },
  async addAssignment(lessonId: number, text: string) { const trimmed = text.trim(); return trimmed ? db.assignments.add({ lessonId, text: trimmed, taskIds: [], createdAt: now() }) as Promise<number> : 0; },
  async updateAssignment(id: number, text: string) { const trimmed = text.trim(); if (trimmed) await db.assignments.update(id, { text: trimmed }); },
  removeAssignment: async (id: number) => { await db.assignments.delete(id); },
  reinsertAssignment: async (assignment: Assignment) => { await db.assignments.put(assignment); },
  async deleteLesson(id: number) { await db.transaction("rw", db.lessons, db.assignments, async () => { await db.assignments.where("lessonId").equals(id).delete(); await db.lessons.delete(id); }); },
  update: async (id: number, patch: Partial<Lesson>) => { await db.lessons.update(id, patch); },
  remove: async (id: number) => { await db.transaction("rw", db.lessons, db.assignments, async () => { await db.assignments.where("lessonId").equals(id).delete(); await db.lessons.delete(id); }); },
  assignmentsForLesson: (lessonId: number) => db.assignments.where("lessonId").equals(lessonId).toArray(),
  ignoreAssignment: async (id: number) => { await db.assignments.update(id, { ignored: true }); },
  restoreAssignment: async (id: number) => { await db.assignments.update(id, { ignored: false }); },
  async linkTask(id: number, taskId: number) { await db.assignments.where("id").equals(id).modify((a) => { if (!a.taskIds.includes(taskId)) a.taskIds.push(taskId); }); },
  async unlinkTask(id: number, taskId: number) { await db.assignments.where("id").equals(id).modify((a) => { a.taskIds = a.taskIds.filter((t) => t !== taskId); }); },
} satisfies LessonPort;
