import type { StudyRoutine, StudyRoutinePort } from "@/domain/ports/studyRoutine";

export class UpdateStudyRoutineUseCase {
  constructor(private readonly routines: StudyRoutinePort) {}

  execute(id: number, patch: Partial<StudyRoutine>) {
    return this.routines.update(id, patch);
  }
}
