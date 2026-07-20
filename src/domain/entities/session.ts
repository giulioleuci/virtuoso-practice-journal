import type { NoteVal, SegmentMetric, SessionQuality } from "./common";

export interface SessionSnapshot {
  taskTitle: string;
  subjectName: string;
  itemTitle?: string;
  itemComposer?: string;
  segments?: { id: string; label: string }[];
  collectionName?: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers?: string[];
  techniqueNames?: string[];
}

export interface Session {
  id: number;
  taskId: number;
  date: string;
  bpmReached?: number;
  noteVal?: NoteVal;
  reps?: number;
  quality?: SessionQuality;
  confidence?: number;
  notes?: string;
  layersUsed?: string[];
  techniquesUsed?: number[];
  layerScores?: Record<string, number>;
  techniqueScores?: Record<number, number>;
  segmentMetrics?: Record<string, SegmentMetric>;
  snapshot?: SessionSnapshot;
  createdAt: number;
}
