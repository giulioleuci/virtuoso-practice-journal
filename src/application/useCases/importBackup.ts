import { belongsToOwner } from "@/domain/logic/tempoProgression";
import type { Task } from "@/domain/entities/task";
import type { TempoProgression } from "@/domain/entities/tempoProgression";
import type { SegmentMark } from "@/domain/entities/common";
import { tempoContextKey } from "@/domain/logic/tempoProgression";
import { sessionTempoIndexes } from "@/domain/entities/session";
import { z } from "zod";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import { isPerformable } from "@/domain/logic/repertoireReview";
import type { AudioPort } from "@/domain/ports/audio";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import type { BackupData, BackupPort } from "@/domain/ports/backup";
import { collectionInputSchema, collectionLinkInputSchema, libraryItemInputSchema, segmentInputSchema, segmentEntrySchema, segmentMarkSchema, taskInputSchema, taskLinkTypeSchema, studyGroupSchema, tempoRuleSchema, tempoProgressionSchema } from "@/lib/schemas";

const SUPPORTED_VERSIONS = [4, 5, 6];
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
    const tables = new Set(["profile", "subjects", "techniques", "library", "segments", "collections", "collectionItems", "tasks", "sessions", "recordings", "performances", "performanceItems", "studyRoutines", "recurrences", "lessons", "assignments", "helpRequests", "tempoProgressions"]);
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
    const subjects = (data.subjects ?? []).map(value => {
      const subject = row.extend({ name: z.string().min(1), type: z.enum(["instrument", "theory", "composition", "other"]), layers: z.array(z.string()).optional() }).parse(value);
      if (subject.type === "theory" && (subject.layers === undefined || (parsed.version === 4 && !subject.layers.length))) subject.layers = [...THEORY_LAYERS];
      return subject;
    });
    const techniques = (data.techniques ?? []).map(value => row.extend({ subjectId: id, name: z.string().min(1) }).parse(value));
    const items = (data.library ?? []).map(value => {
      const current = row.extend({ inRepertoire: z.boolean().optional() }).parse(value);
      delete current.studyStatus;
      return { ...current, ...libraryItemInputSchema.parse(current) };
    });
    const segments = (data.segments ?? []).map(value => ({ ...row.extend({ itemId: id }).parse(value), ...segmentInputSchema.parse(value) }));
    const collections = (data.collections ?? []).map(value => ({ ...row.extend({ updatedAt: z.number() }).parse(value), ...collectionInputSchema.parse(value) }));
    const links = (data.collectionItems ?? []).map(value => ({ ...row.extend({ collectionId: id, itemId: id, position: z.number().int().nonnegative() }).parse(value), ...collectionLinkInputSchema.parse(value) }));
    const tasks = (data.tasks ?? []).map(value => ({ ...row.extend({ done: z.boolean(), tempoRule: tempoRuleSchema.optional(), tempoRuleRevision: id.optional(), studyRoutineId: id.optional(), recurrenceTaskId: id.optional(), recurrence: z.object({ kind: z.enum(["weekdays", "interval"]), startDate: day }).passthrough().optional() }).parse(value), ...taskInputSchema.parse(value) }));
    const sessions = (data.sessions ?? []).map(value => { const session = sessionRow.parse(value); return { ...session, ...sessionTempoIndexes(session.marks as SegmentMark[]) }; });
    const states = (data.tempoProgressions ?? []).map(value => tempoProgressionSchema.parse(value) as TempoProgression);
    const routines = (data.studyRoutines ?? []).map(value => row.extend({ subjectId: id, groups: z.array(studyGroupSchema), tempoRule: tempoRuleSchema.optional(), tempoRuleRevision: id.optional() }).parse(value));
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
        if (entry.segmentId !== undefined) requireReference(segmentById.has(entry.segmentId) && (itemId === undefined ? itemById.get(segmentById.get(entry.segmentId)?.itemId)?.subjectId === subjectId : segmentById.get(entry.segmentId)?.itemId === itemId), `segment ${entry.segmentId}`);
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
    for (const routine of routines) {
      requireReference(subjectIds.has(routine.subjectId), "routine subject");
      for (const entry of routine.groups.flatMap(group => group.pool)) {
        if (entry.type === "item") requireReference(itemById.get(entry.id)?.subjectId === routine.subjectId, "routine material");
        if (entry.type === "segment") requireReference(itemById.get(segmentById.get(entry.id)?.itemId)?.subjectId === routine.subjectId, "routine section");
        if (entry.type === "collection") requireReference(collectionIds.has(entry.id), "routine collection");
      }
    }
    const stateById = new Map(states.map(state => [state.id, state]));
    const identities = new Set<string>();
    for (const state of states) {
      const root = state.owner.kind === "routine" ? routines.find(r => r.id === state.owner.id) : tasks.find(t => t.id === state.owner.id && t.recurrence && t.recurrenceTaskId === undefined);
      requireReference(!!root && state.ruleRevision <= (root.tempoRuleRevision ?? 0), "progression owner/revision");
      requireReference(itemById.has(state.context.itemId), "progression material");
      if (state.context.segmentId !== undefined) requireReference(segmentById.get(state.context.segmentId)?.itemId === state.context.itemId, "progression section");
      checkTechniques(state.context.techniques, itemById.get(state.context.itemId)?.subjectId);
      requireReference(state.contextKey === tempoContextKey(state.context), "progression context key");
      const identity = JSON.stringify([state.owner,state.contextKey]);
      requireReference(!identities.has(identity), "duplicate progression context"); identities.add(identity);
    }
    for (const task of tasks) {
      for (const entry of task.plan) if (entry.progression) {
        const state = stateById.get(entry.progression.id);
        requireReference(!!state && belongsToOwner(task as Task,state.owner), "progression task owner");
      }
      if (task.tempoRule) requireReference(!!task.recurrence && task.recurrenceTaskId === undefined && task.tempoRuleRevision !== undefined, "rule on recurrence root");
      if (task.recurrenceTaskId !== undefined) requireReference(tasks.some(t => t.id === task.recurrenceTaskId && !!t.recurrence && t.recurrenceTaskId === undefined), "recurrence root");
    }
    for (const record of [...tasks.map(t => ({ itemId: t.itemId, entries: t.plan })), ...sessions.map(s => ({ itemId: s.itemId, entries: s.marks }))]) {
      for (const entry of record.entries) if (entry.progression) {
        const state = stateById.get(entry.progression.id);
        const itemId = entry.segmentId === undefined ? record.itemId : segmentById.get(entry.segmentId)?.itemId;
        requireReference(!!state && entry.progression.cycle <= state.cycle && itemId === state.context.itemId && entry.segmentId === state.context.segmentId, "progression reference");
      }
    }
    for (const [table, rows] of Object.entries({ subjects, techniques, library: items, segments, collections, collectionItems: links, tasks, sessions, performances: events, performanceItems: programs, recordings, studyRoutines: routines, tempoProgressions: states })) if (table in data) data[table] = rows;
    await this.backups.importAll(data);
    const available = this.clips && recordings.length ? (await this.clips.available(recordings.map(r => r.uid))).size : 0;
    return { recordings: recordings.length, available };
  }

  async execute(): Promise<ImportSummary | null> {
    const text = await this.files.pick();
    return text === null ? null : this.importContent(text);
  }
}
