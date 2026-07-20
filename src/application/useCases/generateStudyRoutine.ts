import type { StudyRoutineInput, StudyRoutinePort } from "@/domain/ports/studyRoutine";

export class GenerateStudyRoutineUseCase {
  constructor(private readonly routines: StudyRoutinePort) {}
  async execute(input: StudyRoutineInput): Promise<number> {
    if (input.weeksAhead < 1) throw new Error("Study routine requires at least one week");
    return this.routines.create(input);
  }
}
