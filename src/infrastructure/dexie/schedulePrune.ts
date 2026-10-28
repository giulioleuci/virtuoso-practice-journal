import type { Table } from "dexie";
import type { Draft } from "@/domain/entities/common";
import type { Task } from "@/domain/entities/task";
import type { Session } from "@/domain/entities/session";
import type { Assignment } from "@/domain/entities/lesson";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import { scheduleWindowEnd } from "@/lib/recurrence";

interface ScheduleTables {
  tasks: Table<Task, number, Draft<Task>>;
  sessions: Table<Session, number, Draft<Session>>;
  assignments: Table<Assignment, number, Draft<Assignment>>;
  studyRoutines: Table<StudyRoutine, number, Draft<StudyRoutine>>;
}

/**
 * Deletes untouched routine/recurrence rows written beyond the rolling window (pre-window data) and stamps
 * `materializedUntil` on every series so the startup top-up continues from the window. Returns rows deleted.
 */
export async function pruneSchedule(t: ScheduleTables, today: string): Promise<number> {
  const tasks = await t.tasks.toArray();
  const routines = await t.studyRoutines.toArray();
  const start = new Map<string, string>([
    ...routines.map((r) => [`r${r.id}`, r.startDate] as const),
    ...tasks.filter((x) => x.recurrence).map((x) => [`c${x.id}`, x.recurrence!.startDate] as const),
  ]);
  const seriesOf = (x: Task) => x.studyRoutineId !== undefined ? `r${x.studyRoutineId}` : x.recurrenceTaskId !== undefined ? `c${x.recurrenceTaskId}` : x.recurrence ? `c${x.id}` : undefined;
  const sessioned = new Set(await t.sessions.orderBy("taskId").uniqueKeys() as number[]);
  const assigned = new Set((await t.assignments.toArray()).flatMap((a) => a.taskIds));
  const untouched = (x: Task) => !x.recurrence && !x.done && !x.skipped && !x.customized && !x.executionNotes && !sessioned.has(x.id!) && !assigned.has(x.id!);
  const beyond = (x: Task) => { const s = start.get(seriesOf(x) ?? ""); return s !== undefined && x.date > scheduleWindowEnd(s, today); };

  const doomed = tasks.filter((x) => untouched(x) && beyond(x));
  await t.tasks.bulkDelete(doomed.map((x) => x.id!));
  const gone = new Set(doomed.map((x) => x.id));
  for (const r of routines) await t.studyRoutines.update(r.id, { materializedUntil: scheduleWindowEnd(r.startDate, today) });
  for (const root of tasks.filter((x) => x.recurrence)) {
    const end = scheduleWindowEnd(root.recurrence!.startDate, today);
    // Protected rows past the window must not move the stamp, or the gap before them would never be filled.
    const last = tasks.filter((x) => !gone.has(x.id) && !x.deletedAt && (x.id === root.id || x.recurrenceTaskId === root.id) && x.date <= end).map((x) => x.date).sort().at(-1);
    await t.tasks.update(root.id!, { materializedUntil: last ?? end });
  }
  return doomed.length;
}
