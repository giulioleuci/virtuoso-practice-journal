import { z } from "zod";
import { isPerformable } from "@/domain/logic/repertoireReview";
import type { AudioPort } from "@/domain/ports/audio";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import type { BackupData, BackupPort } from "@/domain/ports/backup";
import { collectionInputSchema, collectionLinkInputSchema, libraryItemInputSchema, segmentInputSchema, segmentEntrySchema, segmentMarkSchema, taskInputSchema, taskLinkTypeSchema, studyGroupSchema } from "@/lib/schemas";

const SUPPORTED_VERSIONS = [4];
const id = z.number().int().positive();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const row = z.object({ id, createdAt: z.number(), deletedAt: z.number().optional() }).passthrough();
const backupSchema = z.object({ version: z.number().optional(), exportedAt: z.number().optional(), data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))) });
const snapshotSegment = z.object({ id: z.string().regex(/^\d+$/), label: z.string(), barStart: z.number().int().nonnegative().optional(), barEnd: z.number().int().nonnegative().optional() })
  .refine(v => (v.barStart === undefined && v.barEnd === undefined) || (v.barStart !== undefined && v.barEnd !== undefined && v.barEnd >= v.barStart));
const sessionRow = row.extend({
  taskId: id.optional(), subjectId: id.optional(), itemId: id.optional(), collectionId: id.optional(), linkType: taskLinkTypeSchema.optional(), date: day,
  marks: z.array(segmentMarkSchema).refine(marks => new Set(marks.map(mark => mark.segmentId)).size === marks.length),
  notStudied: z.array(id).optional(),
  snapshot: z.object({ taskTitle: z.string(), subjectName: z.string(), segments: z.array(snapshotSegment).optional() }).passthrough().optional(),
});
/** Clip metadata only: audio payloads, paths and URLs are never imported. */
const recordingRow = z.object({
  id: id.optional(), uid: z.string().uuid(), sessionId: id, segmentId: id.optional(), date: day,
  title: z.string().max(160).optional(), mimeType: z.string().regex(/^audio\//), durationMs: z.number().nonnegative(), createdAt: z.number(),
}).strict();
export interface ImportSummary { recordings: number; available: number }

export class ImportBackupUseCase {
  constructor(private readonly backups: BackupPort, private readonly files: BackupFileGateway, private readonly clips?: Pick<AudioPort, "available">) {}

  /** Validate the whole graph before replacing any table; incompatible fixture formats have no adapter. */
  async importContent(text: string): Promise<ImportSummary> {
    const parsed = backupSchema.parse(JSON.parse(text));
    if (!SUPPORTED_VERSIONS.includes(parsed.version)) throw new Error(`Unsupported backup version: ${parsed.version}`);
    const data: BackupData = { ...parsed.data };
    const tables = new Set(["profile", "subjects", "techniques", "library", "segments", "collections", "collectionItems", "tasks", "sessions", "recordings", "performances", "performanceItems", "studyRoutines", "recurrences", "lessons", "assignments", "helpRequests"]);
    for (const [table, rows] of Object.entries(data)) {
      if (!tables.has(table)) throw new Error(`Unknown backup table: ${table}`);
      const ids = new Set<number | string>();
      for (const value of rows) {
        const key = table === "profile" ? z.object({ id: z.literal("me") }).parse(value).id : z.object({ id: table === "recordings" ? id.optional() : id }).parse(value).id;
        if (key === undefined) continue;
        if (ids.has(key)) throw new Error(`Duplicate ${table} ID: ${key}`);
        ids.add(key);
      }
    }
    const subjects = (data.subjects ?? []).map(value => row.extend({ name: z.string().min(1), type: z.enum(["instrument", "theory", "composition", "other"]) }).parse(value));
    const techniques = (data.techniques ?? []).map(value => row.extend({ subjectId: id, name: z.string().min(1) }).parse(value));
    const items = (data.library ?? []).map(value => {
      const current = row.extend({ inRepertoire: z.boolean().optional() }).parse(value);
      delete current.studyStatus;
      return { ...current, ...libraryItemInputSchema.parse(current) };
    });
    const segments = (data.segments ?? []).map(value => ({ ...row.extend({ itemId: id }).parse(value), ...segmentInputSchema.parse(value) }));
    const collections = (data.collections ?? []).map(value => ({ ...row.extend({ updatedAt: z.number() }).parse(value), ...collectionInputSchema.parse(value) }));
    const links = (data.collectionItems ?? []).map(value => ({ ...row.extend({ collectionId: id, itemId: id, position: z.number().int().nonnegative() }).parse(value), ...collectionLinkInputSchema.parse(value) }));
    const tasks = (data.tasks ?? []).map(value => ({ ...row.extend({ done: z.boolean() }).parse(value), ...taskInputSchema.parse(value) }));
    const sessions = (data.sessions ?? []).map(value => sessionRow.parse(value));
    const events = (data.performances ?? []).map(value => row.extend({ name: z.string().trim().min(1), kind: z.enum(["concert", "exam", "audition"]), subjectId: id.optional(), date: day }).parse(value));
    const programs = (data.performanceItems ?? []).map(value => row.extend({ eventId: id, itemId: id }).parse(value));
    const recordings = z.array(recordingRow).parse(data.recordings ?? []);
    const subjectIds = new Set(subjects.map(s => s.id));
    const itemById = new Map(items.map(item => [item.id, item]));
    const segmentById = new Map(segments.map(segment => [segment.id, segment]));
    const collectionIds = new Set(collections.map(c => c.id));
    const taskIds = new Set(tasks.map(t => t.id));
    const sessionById = new Map(sessions.map(s => [s.id, s]));
    const eventById = new Map(events.map(e => [e.id, e]));
    const techniqueById = new Map(techniques.map(t => [t.id, t]));
    const requireReference = (valid: boolean, name: string) => { if (!valid) throw new Error(`Invalid backup reference: ${name}`); };
    const checkTechniques = (ids: number[] | undefined, subjectId: number | undefined) => {
      for (const id of ids ?? []) requireReference(techniqueById.get(id)?.subjectId === subjectId && techniqueById.has(id), `technique ${id}`);
    };
    const checkEntries = (entries: z.infer<typeof segmentEntrySchema>[], itemId: number | undefined, subjectId: number | undefined) => {
      for (const entry of entries) {
        if (entry.segmentId !== undefined) requireReference(itemId !== undefined && segmentById.get(entry.segmentId)?.itemId === itemId, `segment ${entry.segmentId}`);
        checkTechniques(entry.techniques, subjectId);
      }
    };
    const checkTarget = (target: { subjectId?: number; itemId?: number; collectionId?: number; linkType?: string }, entries: z.infer<typeof segmentEntrySchema>[]) => {
      if (target.subjectId !== undefined) requireReference(subjectIds.has(target.subjectId), "subject");
      if (target.itemId !== undefined) requireReference(itemById.has(target.itemId), "material");
      if (target.collectionId !== undefined) requireReference(collectionIds.has(target.collectionId) && target.itemId === undefined && !entries.some(e => e.segmentId !== undefined), "collection target");
      if (target.linkType === "item") requireReference(target.itemId !== undefined && target.collectionId === undefined, "item target");
      if (target.linkType === "collection") requireReference(target.collectionId !== undefined && target.itemId === undefined, "collection target");
      if (target.linkType === "free") requireReference(target.itemId === undefined && target.collectionId === undefined, "free target");
      checkEntries(entries, target.itemId, target.subjectId);
    };
    for (const technique of techniques) requireReference(subjectIds.has(technique.subjectId), "technique subject");
    for (const item of items) {
      requireReference(subjectIds.has(item.subjectId), "material subject");
      if (item.inRepertoire) requireReference(isPerformable(item.kind), "repertoire material");
      checkTechniques(item.techniqueIds, item.subjectId);
    }
    for (const segment of segments) {
      requireReference(itemById.has(segment.itemId), "segment material");
      checkTechniques(segment.techniqueIds, itemById.get(segment.itemId)?.subjectId);
    }
    for (const collection of collections) if (collection.defaultSubjectId !== undefined) requireReference(subjectIds.has(collection.defaultSubjectId), "collection subject");
    const membership = new Set<string>();
    for (const link of links) {
      requireReference(itemById.has(link.itemId) && collectionIds.has(link.collectionId), "membership");
      const key = `${link.collectionId}:${link.itemId}`;
      requireReference(!membership.has(key), "duplicate membership"); membership.add(key);
    }
    for (const task of tasks) checkTarget(task, task.plan);
    for (const session of sessions) {
      checkTarget(session, session.marks);
      if (session.taskId !== undefined) requireReference(taskIds.has(session.taskId), "session task");
      for (const segmentId of session.notStudied ?? []) requireReference(session.itemId !== undefined && segmentById.get(segmentId)?.itemId === session.itemId, "not-studied segment");
      for (const segment of session.snapshot?.segments ?? []) requireReference(session.itemId !== undefined && segmentById.get(Number(segment.id))?.itemId === session.itemId, "snapshot segment");
    }
    const programmeKeys = new Set<string>();
    for (const program of programs) {
      const item = itemById.get(program.itemId), event = eventById.get(program.eventId);
      requireReference(!!item && isPerformable(item.kind) && !!event, "programme material");
      const key = `${program.eventId}:${program.itemId}`;
      requireReference(!programmeKeys.has(key), "duplicate programme item"); programmeKeys.add(key);
    }
    for (const event of events) if (event.subjectId !== undefined) requireReference(subjectIds.has(event.subjectId), "performance subject");
    const uids = new Set<string>();
    for (const recording of recordings) {
      const session = sessionById.get(recording.sessionId);
      if (!session) throw new Error(`Recording ${recording.uid} points at missing session ${recording.sessionId}`);
      requireReference(!uids.has(recording.uid), "duplicate recording UID"); uids.add(recording.uid);
      if (recording.segmentId !== undefined) requireReference(session?.itemId !== undefined && segmentById.get(recording.segmentId)?.itemId === session.itemId, "recording segment");
    }
    for (const value of data.studyRoutines ?? []) {
      const routine = row.extend({ subjectId: id, groups: z.array(studyGroupSchema) }).parse(value);
      requireReference(subjectIds.has(routine.subjectId), "routine subject");
      for (const entry of routine.groups.flatMap(group => group.pool)) {
        if (entry.type === "item") requireReference(itemById.get(entry.id)?.subjectId === routine.subjectId, "routine material");
        if (entry.type === "segment") requireReference(itemById.get(segmentById.get(entry.id)?.itemId)?.subjectId === routine.subjectId, "routine section");
        if (entry.type === "collection") requireReference(collectionIds.has(entry.id), "routine collection");
      }
    }
    for (const [table, rows] of Object.entries({ subjects, techniques, library: items, segments, collections, collectionItems: links, tasks, sessions, performances: events, performanceItems: programs, recordings })) if (table in data) data[table] = rows;
    await this.backups.importAll(data);
    const available = this.clips && recordings.length ? (await this.clips.available(recordings.map(r => r.uid))).size : 0;
    return { recordings: recordings.length, available };
  }

  async execute(): Promise<ImportSummary | null> {
    const text = await this.files.pick();
    return text === null ? null : this.importContent(text);
  }
}
