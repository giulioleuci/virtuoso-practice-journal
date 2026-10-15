import type { Assignment } from "../entities/lesson";
import type { Task } from "../entities/task";

/** Homework with no task planned yet: waits in the inbox. */
export const needsTask = (a: Pick<Assignment, "taskIds" | "ignored">): boolean => !a.ignored && a.taskIds.length === 0;

/** Homework still to do: unplanned, or planned with at least one linked task not yet done or skipped. */
export function isOpenAssignment(a: Pick<Assignment, "taskIds" | "ignored">, activeTasks: Map<number | undefined, Pick<Task, "done" | "skipped">>): boolean {
  if (a.ignored) return false;
  const linked = a.taskIds.flatMap((id) => activeTasks.get(id) ?? []);
  return linked.length === 0 || linked.some((t) => !t.done && !t.skipped);
}
