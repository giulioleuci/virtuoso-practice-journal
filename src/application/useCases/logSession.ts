import { planSegmentIds } from "@/domain/logic/plan";
import { sessionContext } from "@/domain/logic/sessionContext";
import type { SessionLogInput, SessionPort, SessionTarget } from "@/domain/ports/session";
import { newSessionInputSchema } from "@/lib/schemas";

export class LogSessionUseCase {
  constructor(private readonly sessions: SessionPort, private readonly clock: () => number = Date.now) {}

  /** Saves what was studied. A target with an `id` is the task the session was opened from; without one the session is free. */
  async execute(target: SessionTarget, input: SessionLogInput): Promise<number> {
    const checked = newSessionInputSchema.safeParse({ notes: input.notes, marks: input.marks });
    if (!checked.success) {
      const issue = checked.error.issues[0];
      throw new Error(`Invalid session: ${issue?.path.join(".")} ${issue?.message}`);
    }
    const createdAt = this.clock();
    const helpText = input.helpText?.trim() || undefined;
    const studied = new Set(input.marks.map((m) => m.segmentId));
    const notStudied = target.id === undefined ? [] : planSegmentIds(target.plan).filter((id) => !studied.has(id));
    // Labels of planned and studied sections alike, so history survives renames and deletions.
    const snapshot = await this.sessions.buildSnapshot({ ...target, plan: [...target.plan, ...input.marks] });
    return this.sessions.transaction(async (transaction) => {
      const sessionId = await transaction.createSession({
        taskId: target.id,
        ...sessionContext(target),
        date: input.date,
        notes: input.notes?.trim() || undefined,
        marks: input.marks,
        notStudied: notStudied.length ? notStudied : undefined,
        snapshot,
        createdAt,
      });
      if (target.id !== undefined) await transaction.syncTaskDone(target.id);
      // Audio is already on the device; its metadata commits or rolls back with the session.
      for (const clip of input.clips ?? []) await transaction.createRecording({ ...clip, sessionId, date: input.date, createdAt });
      if (helpText) await transaction.createHelpRequest({ sessionId, taskId: target.id, itemId: target.itemId, question: helpText, createdAt });
      return sessionId;
    });
  }
}
