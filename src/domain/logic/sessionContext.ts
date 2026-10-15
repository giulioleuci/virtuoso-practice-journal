import type { Session } from "../entities/session";
import type { Task } from "../entities/task";

type ContextSource = Pick<Task, "subjectId" | "linkType" | "itemId" | "collectionId">;

/** References a session keeps itself, so history and queries work without its task. */
export const sessionContext = (source: ContextSource): Pick<Session, "subjectId" | "linkType" | "itemId" | "collectionId"> => ({
  subjectId: source.subjectId,
  linkType: source.linkType ?? (source.collectionId !== undefined ? "collection" : source.itemId !== undefined ? "item" : "free"),
  itemId: source.itemId,
  collectionId: source.collectionId,
});

/** Legacy sessions filled from their task; sessions already carrying a subject, or whose task is gone, are returned as they are. */
export function withSessionContext<S extends Partial<Session>>(sessions: S[], tasks: (ContextSource & { id?: number })[]): S[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return sessions.map((session) => {
    const task = session.taskId === undefined ? undefined : byId.get(session.taskId);
    return task && session.subjectId === undefined ? { ...sessionContext(task), ...session } : session;
  });
}
