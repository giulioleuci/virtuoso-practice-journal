import { backupRepository } from "@/infrastructure/repositories/dexie/backupRepository";
import { CapacitorBackupFileGateway } from "@/infrastructure/gateways/CapacitorBackupFileGateway";
import { ExportBackupUseCase } from "@/application/useCases/exportBackup";
import { ImportBackupUseCase } from "@/application/useCases/importBackup";

const files = new CapacitorBackupFileGateway();
export const backupService = {
  exportBackup: () => new ExportBackupUseCase(backupRepository, files).execute(),
  importBackup: () => new ImportBackupUseCase(backupRepository, files).execute(),
  // Transitional compatibility API for callers that already supply/consume backup text.
  exportAll: () => new ExportBackupUseCase(backupRepository, files).createContent(),
  importAll: (content: string) => new ImportBackupUseCase(backupRepository, files).importContent(content),
  wipeAll: () => backupRepository.wipeAll(),
};
