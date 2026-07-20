import type { NoteVal, SegmentMetric, SessionQuality } from "@/domain/entities/common";
import { sessionRepository } from "@/infrastructure/repositories/dexie/sessionRepository";
export interface FullSessionLogInput { date: string; bpmReached?: number; noteVal?: NoteVal; reps?: number; confidence?: number; quality?: SessionQuality; notes?: string; layersUsed: string[]; techniquesUsed: number[]; layerScores?: Record<string, number>; techniqueScores?: Record<number, number>; segmentMetrics?: Record<string, SegmentMetric>; helpText?: string; }
export const sessionsService = sessionRepository;
