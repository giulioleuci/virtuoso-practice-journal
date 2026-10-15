import { z } from "zod";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { withSessionContext } from "@/domain/logic/sessionContext";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import type { BackupData, BackupPort } from "@/domain/ports/backup";

const SUPPORTED_VERSIONS = [1, 2, 3];

const backupSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.number().optional(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
});

const rating = z.number().int().min(1).max(5).optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Stored sessions: ratings may be missing (legacy) but never out of scale. */
const sessionRow = z.object({
  id: z.number().int().positive(),
  taskId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  date: day,
  marks: z.array(z.object({ segmentId: z.number().int().positive().optional(), confidence: rating, mood: rating, focus: rating }).passthrough()),
  notStudied: z.array(z.number().int().positive()).optional(),
}).passthrough();

export class ImportBackupUseCase {
  constructor(private readonly backups: BackupPort, private readonly files: BackupFileGateway) {}

  /** Validates everything first; the store is replaced only by a fully valid backup, in one transaction. */
  async importContent(text: string): Promise<void> {
    const parsed = backupSchema.parse(JSON.parse(text));
    const version = parsed.version ?? 1;
    if (!SUPPORTED_VERSIONS.includes(version)) throw new Error(`Unsupported backup version: ${version}`);
    const data: BackupData = { ...(parsed.data ?? {}) };
    if (data.sessions) {
      const sessions = z.array(sessionRow).parse(data.sessions);
      // Rows are validated above; the cast only bridges zod's passthrough type to the entity.
      data.sessions = version < 3 ? withSessionContext(sessions as unknown as Partial<Session>[], (data.tasks ?? []) as Task[]) : sessions;
    }
    await this.backups.importAll(data);
  }

  async execute(): Promise<boolean> {
    const text = await this.files.pick();
    if (text === null) return false;
    await this.importContent(text);
    return true;
  }
}
