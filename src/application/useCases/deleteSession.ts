import type { SessionPort } from "@/domain/ports/session";
export class DeleteSessionUseCase {
  constructor(private readonly sessions: SessionPort) {}
  execute(sessionId: number, taskId?: number) { return this.sessions.deleteWithTaskReset(sessionId, taskId); }
}
