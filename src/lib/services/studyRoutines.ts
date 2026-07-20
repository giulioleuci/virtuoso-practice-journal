import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import { application, studyRoutineRepository } from "@/infrastructure/compositionRoot";
import type { StudyRoutineConfig } from "@/lib/schemas";

export const studyRoutinesService = {
  create: (config: StudyRoutineConfig) => application.routines.generate.execute(config),
  regenerateFromDate: (routine: StudyRoutine, fromDate: string) => studyRoutineRepository.regenerateFromDate(routine, fromDate),
  update: (id: number, patch: Partial<StudyRoutine>) => studyRoutineRepository.update(id, patch),
  remove: (id: number) => studyRoutineRepository.remove(id),
};
