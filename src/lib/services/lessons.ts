/** Lessons service — wraps writes for recurrences, lessons, and assignments. */
import { db, buildLessonSnapshot, type Lesson, type LessonRecurrence } from "@/lib/db";

export const lessonsService = {
  async upsertRecurrence(data: Omit<LessonRecurrence, "id">, id?: number): Promise<number> {
    if (id) {
      await db.recurrences.put({ ...data, id });
      return id;
    }
    return (await db.recurrences.add(data)) as number;
  },

  async deleteRecurrence(id: number): Promise<void> {
    await db.recurrences.delete(id);
  },

  async log(
    subjectId: number,
    recurrence: LessonRecurrence | null | undefined,
    date: string,
    notes: string | undefined,
    assignmentTexts: string[],
  ): Promise<number> {
    const { snapshot, piecesPlayedTitles } = await buildLessonSnapshot(subjectId, recurrence ?? null, []);
    let lessonId = 0;
    const now = Date.now();
    await db.transaction("rw", db.lessons, db.assignments, async () => {
      lessonId = (await db.lessons.add({
        recurrenceId: recurrence?.id,
        subjectId,
        date,
        notes: notes?.trim() || undefined,
        piecesPlayed: [],
        snapshot,
        piecesPlayedTitles,
        createdAt: now,
      })) as number;
      if (assignmentTexts.length) {
        await db.assignments.bulkAdd(
          assignmentTexts.map((text) => ({
            lessonId,
            text,
            transformed: false,
            createdAt: now,
          })),
        );
      }
    });
    return lessonId;
  },

  async updateLesson(lesson: Lesson, date: string, notes: string | undefined, assignmentTexts: string[]): Promise<void> {
    const now = Date.now();
    await db.transaction("rw", db.lessons, db.assignments, async () => {
      await db.lessons.put({ ...lesson, date, notes: notes?.trim() || undefined });
      await db.assignments.where("lessonId").equals(lesson.id!).delete();
      if (assignmentTexts.length) {
        await db.assignments.bulkAdd(
          assignmentTexts.map((text) => ({
            lessonId: lesson.id!,
            text,
            transformed: false,
            createdAt: now,
          })),
        );
      }
    });
  },

  async deleteLesson(lessonId: number): Promise<void> {
    await db.transaction("rw", db.lessons, db.assignments, async () => {
      await db.assignments.where("lessonId").equals(lessonId).delete();
      await db.lessons.delete(lessonId);
    });
  },

  async ignoreAssignment(id: number): Promise<void> {
    await db.assignments.update(id, { ignored: true });
  },

  async restoreAssignment(id: number): Promise<void> {
    await db.assignments.update(id, { ignored: false });
  },

  async transformAssignment(id: number, taskId: number): Promise<void> {
    await db.assignments.update(id, { transformed: true, taskId });
  },
};
