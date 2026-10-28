import type { StudyRoutineGenerationPort, StudyRoutineInput } from "@/domain/ports/studyRoutine";
import { dayKey, addDays, parseDayKey } from "@/lib/date";
import { generateRoutineTasks, poolEntryKey, routineAdaptivity, routineWindowEnd, type ResolvedPoolItem } from "@/lib/domain/studyRoutineGenerator";

export class GenerateStudyRoutineUseCase {
  constructor(private readonly routines: StudyRoutineGenerationPort, private readonly clock: () => number = () => Date.now()) {}

  async execute(input: StudyRoutineInput): Promise<number> {
    if (input.weeksAhead < 1) throw new Error("Study routine requires at least one week");
    if (input.repetitionCap < 1) throw new Error("Study routine requires a positive repetition cap");
    if (!input.groups.length || input.groups.some((group) => !group.pool.length)) throw new Error("Study routine requires a non-empty pool for every group");

    const toDate = routineWindowEnd(input, dayKey(new Date(this.clock())));
    const materializedUntil = dayKey(addDays(parseDayKey(toDate), -1));
    const routine = await this.routines.createRoutine({ ...input, materializedUntil }, this.clock());
    const entries = routine.groups.flatMap((group) => group.pool);
    const pool = await this.routines.resolvePool(entries);
    const groupItems = new Map(
      routine.groups.map((group) => [
        group.id,
        group.pool
          .map((entry) => pool.get(poolEntryKey(entry)))
          .filter((item): item is ResolvedPoolItem => Boolean(item)),
      ]),
    );
    const stats = routineAdaptivity(routine) === "uniform" ? null : await this.routines.stats(entries);
    const tasks = generateRoutineTasks({
      routine,
      groupItems,
      stats,
      fromDate: routine.startDate,
      toDate,
      createdAt: routine.createdAt,
      weekStartsOn: await this.routines.weekStartsOn(),
    });
    if (tasks.length) await this.routines.persistTasks(tasks);
    return routine.id;
  }
}
