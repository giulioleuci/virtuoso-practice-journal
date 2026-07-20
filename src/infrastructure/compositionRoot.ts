import { CreateTaskUseCase } from "@/application/useCases/createTask";
import { DeleteSessionUseCase } from "@/application/useCases/deleteSession";
import { GenerateStudyRoutineUseCase } from "@/application/useCases/generateStudyRoutine";
import { LogSessionUseCase } from "@/application/useCases/logSession";
import { RemoveTaskUseCase } from "@/application/useCases/removeTask";
import { UpdateTaskUseCase } from "@/application/useCases/updateTask";
import { taskRepository } from "./repositories/dexie/taskRepository";
import { sessionRepository } from "./repositories/dexie/sessionRepository";
import { studyRoutineRepository } from "./repositories/dexie/studyRoutineRepository";

export const application = {
  tasks: { create: new CreateTaskUseCase(taskRepository), update: new UpdateTaskUseCase(taskRepository), remove: new RemoveTaskUseCase(taskRepository) },
  sessions: { log: new LogSessionUseCase(sessionRepository), remove: new DeleteSessionUseCase(sessionRepository) },
  routines: { generate: new GenerateStudyRoutineUseCase(studyRoutineRepository) },
};
export { taskRepository, sessionRepository, studyRoutineRepository };
