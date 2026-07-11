/** Pending (draft) homework — captured async during a lesson, before it's logged. */
import { db, type PendingAssignment } from "@/lib/db";

export const pendingAssignmentsService = {
  async add(subjectId: number, text: string, recurrenceId?: number): Promise<number> {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return (await db.pendingAssignments.add({
      subjectId,
      recurrenceId,
      text: trimmed,
      createdAt: Date.now(),
    })) as number;
  },

  async remove(id: number): Promise<void> {
    await db.pendingAssignments.delete(id);
  },

  async update(id: number, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    await db.pendingAssignments.update(id, { text: trimmed });
  },


  async removeMany(ids: number[]): Promise<void> {
    if (!ids.length) return;
    await db.pendingAssignments.bulkDelete(ids);
  },

  async listFor(subjectId: number, recurrenceId?: number): Promise<PendingAssignment[]> {
    const rows = await db.pendingAssignments.where("subjectId").equals(subjectId).toArray();
    return rows
      .filter((r) => (recurrenceId ? r.recurrenceId === recurrenceId || r.recurrenceId == null : true))
      .sort((a, b) => a.createdAt - b.createdAt);
  },
};
