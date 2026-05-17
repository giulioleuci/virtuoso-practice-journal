/** Subjects service — wraps writes for subjects and techniques. */
import { db, type Subject } from "@/lib/db";

export const subjectsService = {
  async create(name: string, type: Subject["type"]): Promise<number> {
    return (await db.subjects.add({ name, type, layers: [], createdAt: Date.now() })) as number;
  },

  async remove(subjectId: number): Promise<void> {
    await db.transaction("rw", db.subjects, db.techniques, async () => {
      await db.techniques.where("subjectId").equals(subjectId).delete();
      await db.subjects.delete(subjectId);
    });
  },

  async addLayer(subjectId: number, layer: string): Promise<void> {
    const subject = await db.subjects.get(subjectId);
    if (!subject) return;
    const current = subject.layers ?? [];
    if (current.includes(layer)) return;
    await db.subjects.update(subjectId, { layers: [...current, layer] });
  },

  async removeLayer(subjectId: number, layer: string): Promise<void> {
    const subject = await db.subjects.get(subjectId);
    if (!subject) return;
    await db.subjects.update(subjectId, { layers: (subject.layers ?? []).filter((l) => l !== layer) });
  },

  async addTechnique(subjectId: number, name: string): Promise<number> {
    return (await db.techniques.add({ subjectId, name, createdAt: Date.now() })) as number;
  },

  async removeTechnique(id: number): Promise<void> {
    await db.techniques.delete(id);
  },
};
