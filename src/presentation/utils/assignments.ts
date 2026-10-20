import type { Assignment } from "@/domain/entities/lesson";
import type { Task } from "@/domain/entities/task";

/** Deleted tasks no longer count as scheduled homework. Until tasks load nothing is pending, or every assignment would flash as unplanned. */
export function assignmentsToPlan(assignments: readonly Assignment[] = [], tasks?: readonly Task[]) {
  if (!tasks) return [];
  const activeIds = new Set(tasks.map(task => task.id));
  return assignments.filter(assignment => !assignment.ignored && !assignment.taskIds.some(id => activeIds.has(id)));
}
