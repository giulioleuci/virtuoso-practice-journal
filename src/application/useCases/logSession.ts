import type { Task } from "@/domain/entities/task";
import type { SessionLogInput, SessionPort } from "@/domain/ports/session";
export class LogSessionUseCase {
  constructor(private readonly sessions: SessionPort, private readonly clock: () => number = Date.now) {}
  async execute(task: Task, input: SessionLogInput): Promise<number> {
    const taskId = task.id;
    if (taskId === undefined) throw new Error("Cannot log a session for an unsaved task");
    const createdAt = this.clock();
    const helpText = input.helpText?.trim() || undefined;
    const effectiveTask = {
      ...task,
      layers: input.layersUsed,
      techniqueIds: input.techniquesUsed,
      targetBpm: input.bpmReached ?? task.targetBpm,
      noteVal: input.noteVal ?? task.noteVal,
    };
    const snapshot = await this.sessions.buildSnapshot(effectiveTask);
    return this.sessions.transaction(async (transaction) => {
      const sessionId = await transaction.createSession({
        taskId,
        date: input.date,
        bpmReached: input.bpmReached,
        noteVal: input.noteVal,
        reps: input.reps,
        confidence: input.confidence,
        quality: input.quality,
        notes: input.notes?.trim() || undefined,
        layersUsed: input.layersUsed,
        techniquesUsed: input.techniquesUsed,
        layerScores: input.layerScores,
        techniqueScores: input.techniqueScores,
        segmentMetrics: input.segmentMetrics,
        snapshot,
        createdAt,
      });
      await transaction.completeTask(taskId);
      if (helpText) await transaction.createHelpRequest({ sessionId, taskId, itemId: task.itemId, question: helpText, createdAt });
      return sessionId;
    });
  }
}
