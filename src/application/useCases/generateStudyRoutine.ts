import type { StudyRoutineGenerationPort, StudyRoutineInput } from "@/domain/ports/studyRoutine";
import { generateRoutineTasks, poolEntryKey, routineAdaptivity, type ResolvedPoolItem } from "@/lib/domain/studyRoutineGenerator";

export class GenerateStudyRoutineUseCase {
  constructor(private readonly routines: StudyRoutineGenerationPort, private readonly clock: () => number = Date.now) {}

  async execute(input: StudyRoutineInput): Promise<number> {
    if (input.weeksAhead < 1) throw new Error("Study routine requires at least one week");
    if (input.repetitionCap < 1) throw new Error("Study routine requires a positive repetition cap");
    if (!input.groups.length || input.groups.some((group) => !group.pool.length)) throw new Error("Study routine requires a non-empty pool for every group");

    const routine = await this.routines.createRoutine(input, this.clock());
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
      createdAt: routine.createdAt,
      weekStartsOn: await this.routines.weekStartsOn(),
    });
    if (tasks.length) await this.routines.persistTasks(tasks);
    return routine.id;
  }
}
