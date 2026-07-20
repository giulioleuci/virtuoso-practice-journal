import type { ColorKey, Subject, Technique } from "../entities/common";

export interface SubjectPort {
  create(name: string, type: Subject["type"]): Promise<number>;
  remove(subjectId: number): Promise<void>;
  addLayer(subjectId: number, layer: string): Promise<void>;
  removeLayer(subjectId: number, layer: string): Promise<void>;
  addTechnique(subjectId: number, name: string): Promise<number>;
  removeTechnique(id: number): Promise<void>;
  rename(subjectId: number, newName: string): Promise<void>;
  setColor(subjectId: number, color: ColorKey): Promise<void>;
  setCustomColor(subjectId: number, customColor: string | undefined): Promise<void>;
  renameLayer(subjectId: number, oldName: string, newName: string): Promise<void>;
  renameTechnique(id: number, newName: string): Promise<void>;
  list(): Promise<Subject[]>;
  listTechniques(): Promise<Technique[]>;
}
