import type { PersistedTask, SessionLogInput, SessionPort } from "@/domain/ports/session";
export class LogSessionUseCase {
  constructor(private readonly sessions: SessionPort, private readonly _clock: () => number = Date.now) {}
  execute(task: PersistedTask, input: SessionLogInput): Promise<number> {
    return this.sessions.logWithCompletion(task, { ...input, notes: input.notes?.trim() || undefined, helpText: input.helpText?.trim() || undefined });
  }
}
