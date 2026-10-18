import type { Task } from "@/domain/entities/task";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";

export type DiaryTaskOrder = "routine" | "title" | "created";

export function routineTaskOrder(task: Task, routine: StudyRoutine): number {
  const index = routine.groups.findIndex(group =>
    (group.combine && task.linkType === "free" && task.title === group.name) || group.pool.some(entry =>
      entry.type === "item" ? entry.id === task.itemId :
      entry.type === "collection" ? entry.id === task.collectionId :
      task.plan.some(section => section.segmentId === entry.id)));
  return index < 0 ? Infinity : index;
}

export function sortDiaryTasks(tasks: Task[], routines: StudyRoutine[], order: DiaryTaskOrder, locale: string): Task[] {
  const byId = new Map(routines.map(routine => [routine.id, routine]));
  const ranks = new Map(tasks.map(task => {
    const routine = byId.get(task.studyRoutineId);
    return [task, routine ? routineTaskOrder(task, routine) : Infinity];
  }));
  return [...tasks].sort((a, b) => {
    if (order === "routine") {
      const origin = Number(b.studyRoutineId !== undefined) - Number(a.studyRoutineId !== undefined);
      if (origin) return origin;
    }
    if (order === "routine" && a.studyRoutineId !== undefined && b.studyRoutineId !== undefined) {
      const routine = a.studyRoutineId - b.studyRoutineId || ranks.get(a) - ranks.get(b);
      if (routine) return routine;
    }
    const done = Number(a.done) - Number(b.done);
    if (done) return done;
    if (order === "title") {
      const title = a.title.localeCompare(b.title, locale, { numeric: true, sensitivity: "base" });
      if (title) return title;
    }
    return a.createdAt - b.createdAt || (a.id ?? 0) - (b.id ?? 0);
  });
}
