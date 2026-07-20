import { db } from "@/infrastructure/dexie/db";
import type { ColorKey, Subject } from "@/domain/entities/common";
import type { SubjectPort } from "@/domain/ports/subject";
import { now } from "@/lib/date";

export const subjectRepository = {
  create: (name: string, type: Subject["type"]) => db.subjects.add({ name, type, layers: [], createdAt: now() }) as Promise<number>,
  async remove(subjectId: number) { await db.transaction("rw", db.subjects, db.techniques, async () => { await db.techniques.where("subjectId").equals(subjectId).delete(); await db.subjects.delete(subjectId); }); },
  async addLayer(subjectId: number, layer: string) { const subject = await db.subjects.get(subjectId); if (subject && !(subject.layers ?? []).includes(layer)) await db.subjects.update(subjectId, { layers: [...(subject.layers ?? []), layer] }); },
  async removeLayer(subjectId: number, layer: string) { const subject = await db.subjects.get(subjectId); if (subject) await db.subjects.update(subjectId, { layers: (subject.layers ?? []).filter((value) => value !== layer) }); },
  addTechnique: (subjectId: number, name: string) => db.techniques.add({ subjectId, name, createdAt: now() }) as Promise<number>,
  removeTechnique: async (id: number) => { await db.techniques.delete(id); },
  rename: async (subjectId: number, name: string) => { await db.subjects.update(subjectId, { name }); },
  setColor: async (subjectId: number, color: ColorKey) => { await db.subjects.update(subjectId, { color, customColor: undefined }); },
  setCustomColor: async (subjectId: number, customColor: string | undefined) => { await db.subjects.update(subjectId, { customColor }); },
  async renameLayer(subjectId: number, oldName: string, newName: string) { const subject = await db.subjects.get(subjectId); if (subject) await db.subjects.update(subjectId, { layers: (subject.layers ?? []).map((value) => value === oldName ? newName : value) }); },
  renameTechnique: async (id: number, name: string) => { await db.techniques.update(id, { name }); },
  list: () => db.subjects.toArray(),
  listTechniques: () => db.techniques.toArray(),
} satisfies SubjectPort;
