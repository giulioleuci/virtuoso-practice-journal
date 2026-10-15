import { z } from "zod";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { withSessionContext } from "@/domain/logic/sessionContext";
import type { AudioPort } from "@/domain/ports/audio";
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

export interface ImportSummary { recordings: number; available: number }

/** Clip metadata only: any audio payload, path or URL makes the backup invalid. */
const recordingRow = z.object({
  id: z.number().int().positive().optional(),
  uid: z.string().uuid(),
  sessionId: z.number().int().positive(),
  segmentId: z.number().int().positive().optional(),
  date: day,
  title: z.string().max(160).optional(),
  mimeType: z.string().regex(/^audio\//),
  durationMs: z.number().nonnegative(),
  createdAt: z.number(),
}).strict();

export class ImportBackupUseCase {
  constructor(private readonly backups: BackupPort, private readonly files: BackupFileGateway, private readonly clips?: Pick<AudioPort, "available">) {}

  /** Validates everything first; the store is replaced only by a fully valid backup, in one transaction. */
  async importContent(text: string): Promise<ImportSummary> {
    const parsed = backupSchema.parse(JSON.parse(text));
    const version = parsed.version ?? 1;
    if (!SUPPORTED_VERSIONS.includes(version)) throw new Error(`Unsupported backup version: ${version}`);
    const data: BackupData = { ...(parsed.data ?? {}) };
    if (data.sessions) {
      const sessions = z.array(sessionRow).parse(data.sessions);
      // Rows are validated above; the cast only bridges zod's passthrough type to the entity.
      data.sessions = version < 3 ? withSessionContext(sessions as unknown as Partial<Session>[], (data.tasks ?? []) as Task[]) : sessions;
    }
    const recordings = z.array(recordingRow).parse(data.recordings ?? []);
    const sessionIds = new Set((data.sessions ?? []).map((session) => (session as { id: number }).id));
    const dangling = recordings.find((recording) => !sessionIds.has(recording.sessionId));
    if (dangling) throw new Error(`Recording ${dangling.uid} points at missing session ${dangling.sessionId}`);
    await this.backups.importAll(data);
    // Local audio is never touched by an import; report how many referenced clips this device can still play.
    const available = this.clips && recordings.length ? (await this.clips.available(recordings.map((r) => r.uid))).size : 0;
    return { recordings: recordings.length, available };
  }

  async execute(): Promise<ImportSummary | null> {
    const text = await this.files.pick();
    if (text === null) return null;
    return this.importContent(text);
  }
}
