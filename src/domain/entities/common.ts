export type Lang = "en" | "it" | "es" | "de";
export type SubjectType = "instrument" | "theory" | "composition" | "other";
export type LibraryKind = "repertoire" | "manual" | "technique" | "theory";
export type NoteVal = "half" | "quarter" | "eighth" | "sixteenth";
export type SessionQuality = "hard" | "improve" | "well" | "great";
export type ColorKey = "terracotta" | "sage" | "gold" | "blue" | "plum" | "coral" | "amber" | "teal" | "indigo" | "slate";
export type ReminderFreq = "daily" | "weekdays" | "custom";

export interface SegmentMetric {
  confidence?: number;
  quality?: SessionQuality;
  bpmReached?: number;
  reps?: number;
  layersUsed?: string[];
  techniquesUsed?: number[];
  layerScores?: Record<string, number>;
  techniqueScores?: Record<number, number>;
}

export interface Subject {
  id?: number;
  name: string;
  type: SubjectType;
  layers?: string[];
  color?: ColorKey;
  customColor?: string;
  createdAt: number;
  deletedAt?: number;
}

export interface Technique {
  id: number;
  subjectId: number;
  name: string;
  createdAt: number;
  deletedAt?: number;
}

export type Draft<T extends { id?: number }> = Omit<T, "id"> & { id?: number };
