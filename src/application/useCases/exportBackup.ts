import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import type { BackupPort } from "@/domain/ports/backup";

export class ExportBackupUseCase {
  constructor(
    private readonly backups: BackupPort,
    private readonly files: BackupFileGateway,
    private readonly clock: () => number = Date.now,
  ) {}

  async createContent(exportedAt = this.clock()): Promise<string> {
    return JSON.stringify({ version: 3, exportedAt, data: await this.backups.exportAll() }, null, 2);
  }

  async execute(): Promise<void> {
    const exportedAt = this.clock();
    const content = await this.createContent(exportedAt);
    const filename = `virtuoso-backup-${new Date(exportedAt).toISOString().slice(0, 10)}.json`;
    await this.files.save(filename, content);
  }
}
