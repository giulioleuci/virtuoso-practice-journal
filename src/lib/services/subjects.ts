/** Subjects service — wraps writes for subjects and techniques. */
import { db, type Subject, type ColorKey } from "@/lib/db";
import { cascadeDelete, now } from "./_shared";

export const subjectsService = {
  async create(name: string, type: Subject["type"]): Promise<number> {
    return (await db.subjects.add({ name, type, layers: [], createdAt: now() })) as number;
  },

  async remove(subjectId: number): Promise<void> {
    await cascadeDelete(db.subjects, subjectId, [{ table: db.techniques, fk: "subjectId" }]);
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
    return (await db.techniques.add({ subjectId, name, createdAt: now() })) as number;
  },

  async removeTechnique(id: number): Promise<void> {
    await db.techniques.delete(id);
  },

  async rename(subjectId: number, newName: string): Promise<void> {
    await db.subjects.update(subjectId, { name: newName });
  },

  /** Set a preset color, clearing any custom color. */
  async setColor(subjectId: number, color: ColorKey): Promise<void> {
    await db.subjects.update(subjectId, { color, customColor: undefined });
  },

  /** Set or clear a custom hex color. */
  async setCustomColor(subjectId: number, customColor: string | undefined): Promise<void> {
    await db.subjects.update(subjectId, { customColor });
  },

  async renameLayer(subjectId: number, oldName: string, newName: string): Promise<void> {
    const subject = await db.subjects.get(subjectId);
    if (!subject) return;
    const layers = (subject.layers ?? []).map((l) => (l === oldName ? newName : l));
    await db.subjects.update(subjectId, { layers });
  },

  async renameTechnique(id: number, newName: string): Promise<void> {
    await db.techniques.update(id, { name: newName });
  },
};
