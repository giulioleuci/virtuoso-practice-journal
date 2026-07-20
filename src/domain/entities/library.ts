import type { LibraryKind, NoteVal } from "./common";

export interface LibraryItem {
  id?: number;
  subjectId: number;
  kind: LibraryKind;
  title: string;
  composer?: string;
  startBpm?: number;
  targetBpm?: number;
  noteVal?: NoteVal;
  techniqueIds?: number[];
  totalExercises?: number;
  currentExercise?: number;
  mastery?: { conceptual: number; analytical: number; aural: number; compositional: number; reading?: number };
  tags?: string[];
  createdAt: number;
  deletedAt?: number;
}

export interface Segment {
  id: number;
  itemId: number;
  label: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers: string[];
  techniqueIds?: number[];
  createdAt: number;
  deletedAt?: number;
}
