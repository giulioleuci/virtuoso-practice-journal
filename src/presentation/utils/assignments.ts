import type { Assignment } from "@/domain/entities/lesson";
import type { Task } from "@/domain/entities/task";

/** Deleted tasks no longer count as scheduled homework. */
export function assignmentsToPlan(assignments: readonly Assignment[], tasks: readonly Task[]) {
  const activeIds = new Set(tasks.map(task => task.id));
  return assignments.filter(assignment => !assignment.ignored && !assignment.taskIds.some(id => activeIds.has(id)));
}
