import { db } from "@/infrastructure/dexie/db";
import type { PendingAssignmentPort } from "@/domain/ports/pendingAssignment";

export const pendingAssignmentRepository = {
  async add(subjectId: number, text: string, recurrenceId?: number) { const trimmed = text.trim(); return trimmed ? db.pendingAssignments.add({ subjectId, recurrenceId, text: trimmed, createdAt: Date.now() }) as Promise<number> : 0; },
  remove: async (id: number) => { await db.pendingAssignments.delete(id); },
  async update(id: number, text: string) { const trimmed = text.trim(); if (trimmed) await db.pendingAssignments.update(id, { text: trimmed }); },
  async removeMany(ids: number[]) { if (ids.length) await db.pendingAssignments.bulkDelete(ids); },
  async listFor(subjectId: number, recurrenceId?: number) { const rows = await db.pendingAssignments.where("subjectId").equals(subjectId).toArray(); return rows.filter((row) => recurrenceId ? row.recurrenceId === recurrenceId || row.recurrenceId == null : true).sort((a, b) => a.createdAt - b.createdAt); },
} satisfies PendingAssignmentPort;
