import type { StudyRoutine, StudyRoutinePort } from "@/domain/ports/studyRoutine";

export class RegenerateStudyRoutineUseCase {
  constructor(private readonly routines: StudyRoutinePort) {}

  execute(routine: StudyRoutine, fromDate: string) {
    return this.routines.regenerateFromDate(routine, fromDate);
  }
}
