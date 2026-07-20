import type { NoteVal, SegmentMetric, SessionQuality } from "@/domain/entities/common";
import { application, sessionRepository } from "@/infrastructure/compositionRoot";
export interface FullSessionLogInput { date: string; bpmReached?: number; noteVal?: NoteVal; reps?: number; confidence?: number; quality?: SessionQuality; notes?: string; layersUsed: string[]; techniquesUsed: number[]; layerScores?: Record<string, number>; techniqueScores?: Record<number, number>; segmentMetrics?: Record<string, SegmentMetric>; helpText?: string; }
export const sessionsService = {
  ...sessionRepository,
  logWithCompletion: (task: Parameters<typeof application.sessions.log.execute>[0], input: Parameters<typeof application.sessions.log.execute>[1]) => application.sessions.log.execute(task, input),
  deleteWithTaskReset: (id: number, taskId?: number) => application.sessions.remove.execute(id, taskId),
};
