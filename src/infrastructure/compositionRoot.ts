import { TempoProgressionUseCase } from "@/application/useCases/tempoProgression";
import { tempoProgressionRepository } from "./repositories/dexie/tempoProgressionRepository";
import { CreateTaskUseCase } from "@/application/useCases/createTask";
import { GenerateStudyRoutineUseCase } from "@/application/useCases/generateStudyRoutine";
import { LogSessionUseCase } from "@/application/useCases/logSession";
import { RemoveTaskUseCase } from "@/application/useCases/removeTask";
import { UpdateTaskUseCase } from "@/application/useCases/updateTask";
import { ExportCsvUseCase } from "@/application/useCases/exportCsv";
import { ExportBackupUseCase } from "@/application/useCases/exportBackup";
import { ImportBackupUseCase } from "@/application/useCases/importBackup";
import { CapacitorBackupFileGateway } from "./gateways/CapacitorBackupFileGateway";
import { browserAudio } from "./audio/browserAudio";
import { clearSessionDrafts } from "@/lib/sessionDrafts";
import { clearLiveLesson } from "@/lib/liveLesson";
import { backupRepository } from "./repositories/dexie/backupRepository";
import { taskRepository } from "./repositories/dexie/taskRepository";
import { sessionRepository } from "./repositories/dexie/sessionRepository";
import { recordingRepository } from "./repositories/dexie/recordingRepository";
import { studyRoutineRepository } from "./repositories/dexie/studyRoutineRepository";

const backupFiles = new CapacitorBackupFileGateway();

export const application = {
  tempoProgression: new TempoProgressionUseCase(tempoProgressionRepository),
  tasks: { create: new CreateTaskUseCase(taskRepository), update: new UpdateTaskUseCase(taskRepository), remove: new RemoveTaskUseCase(taskRepository) },
  sessions: { log: new LogSessionUseCase(sessionRepository) },
  audio: browserAudio,
  recordings: recordingRepository,
  routines: {
    generate: new GenerateStudyRoutineUseCase(studyRoutineRepository),
    update: (...args: Parameters<typeof studyRoutineRepository.update>) => studyRoutineRepository.update(...args),
    regenerate: (...args: Parameters<typeof studyRoutineRepository.regenerateFromDate>) => studyRoutineRepository.regenerateFromDate(...args),
  },
  backups: {
    export: new ExportBackupUseCase(backupRepository, backupFiles),
    csv: new ExportCsvUseCase(sessionRepository, backupFiles),
    import: new ImportBackupUseCase(backupRepository, backupFiles, browserAudio),
    wipe: async () => { await backupRepository.wipeAll(); await browserAudio.wipe(); clearSessionDrafts(); clearLiveLesson(); },
  },
};
export { taskRepository, sessionRepository, studyRoutineRepository };
