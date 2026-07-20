import { z } from "zod";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import type { BackupData, BackupPort } from "@/domain/ports/backup";

const backupSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.number().optional(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
});

export class ImportBackupUseCase {
  constructor(private readonly backups: BackupPort, private readonly files: BackupFileGateway) {}

  async importContent(text: string): Promise<void> {
    const parsed = backupSchema.parse(JSON.parse(text));
    if (parsed.version != null && ![1, 2].includes(parsed.version)) {
      throw new Error(`Unsupported backup version: ${parsed.version}`);
    }
    await this.backups.importAll((parsed.data ?? {}) as BackupData);
  }

  async execute(): Promise<boolean> {
    const text = await this.files.pick();
    if (text === null) return false;
    await this.importContent(text);
    return true;
  }
}
