import { application, sessionRepository } from "@/infrastructure/compositionRoot";
export const sessionsService = {
  ...sessionRepository,
  logWithCompletion: (task: Parameters<typeof application.sessions.log.execute>[0], input: Parameters<typeof application.sessions.log.execute>[1]) => application.sessions.log.execute(task, input),
};
