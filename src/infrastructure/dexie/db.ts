import Dexie, { type Table } from "dexie";
import type { Draft } from "@/domain/entities/common";
import type { Profile } from "@/domain/entities/profile";
import type { Subject, Technique } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Task } from "@/domain/entities/task";
import type { Session } from "@/domain/entities/session";
import type { Lesson, LessonFrequency, LessonRecurrence } from "@/domain/entities/lesson";
import type { Collection, CollectionItem } from "@/domain/entities/collection";
import type { HelpRequest } from "@/domain/ports/helpRequest";
import type { PendingAssignment } from "@/domain/ports/pendingAssignment";
import type { StudyPoolEntry, StudyGroup, StudyRoutine } from "@/domain/ports/studyRoutine";

export type { HelpRequest, PendingAssignment, StudyPoolEntry, StudyGroup, StudyRoutine };

export class VirtuosoDB extends Dexie {
  declare profile: Table<Profile, string>;
  declare subjects: Table<Subject, number, Draft<Subject>>;
  declare techniques: Table<Technique, number, Draft<Technique>>;
  declare library: Table<LibraryItem, number, Draft<LibraryItem>>;
  declare segments: Table<Segment, number, Draft<Segment>>;
  declare tasks: Table<Task, number, Draft<Task>>;
  declare sessions: Table<Session, number, Draft<Session>>;
  declare helpRequests: Table<HelpRequest, number, Draft<HelpRequest>>;
  declare recurrences: Table<LessonRecurrence, number, Draft<LessonRecurrence>>;
  declare lessons: Table<Lesson, number, Draft<Lesson>>;
  declare assignments: Table<import("@/domain/entities/lesson").Assignment, number, Draft<import("@/domain/entities/lesson").Assignment>>;
  declare collections: Table<Collection, number, Draft<Collection>>;
  declare collectionItems: Table<CollectionItem, number, Draft<CollectionItem>>;
  declare studyRoutines: Table<StudyRoutine, number, Draft<StudyRoutine>>;
  declare pendingAssignments: Table<PendingAssignment, number, Draft<PendingAssignment>>;

  constructor() {
    super("virtuoso");
    this.version(1).stores({ profile: "id", subjects: "++id, name, type", library: "++id, subjectId, kind, title", segments: "++id, itemId", tasks: "++id, date, subjectId, itemId, done", sessions: "++id, taskId, date", helpRequests: "++id, sessionId, itemId, resolved", recurrences: "++id, subjectId", lessons: "++id, recurrenceId, subjectId, date", assignments: "++id, lessonId, transformed" });
    this.version(2).stores({ techniques: "++id, subjectId, name" });
    this.version(3).stores({ subjects: "++id, name, type, deletedAt", library: "++id, subjectId, kind, title, deletedAt", segments: "++id, itemId, deletedAt", tasks: "++id, date, subjectId, itemId, done, deletedAt", recurrences: "++id, subjectId, deletedAt", techniques: "++id, subjectId, name, deletedAt" });
    this.version(4).stores({ collections: "++id, name, composer, defaultSubjectId, deletedAt", collectionItems: "++id, collectionId, itemId, [collectionId+itemId]" });
    this.version(5).stores({ tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt" }).upgrade(async (tx) => { await tx.table("tasks").toCollection().modify((t: Task) => { const legacy = (t as Task & { segmentId?: number }).segmentId; if (legacy && !t.segmentIds?.length) t.segmentIds = [legacy]; delete (t as Task & { segmentId?: number }).segmentId; if (!t.linkType) t.linkType = t.itemId ? "item" : "free"; }); });
    this.version(6).stores({ collections: "++id, name, kind, composer, defaultSubjectId, deletedAt" }).upgrade(async (tx) => { await tx.table("collections").toCollection().modify((c: Collection) => { if (!c.kind) c.kind = "repertoire"; }); });
    this.version(7).stores({ studyRoutines: "++id, subjectId, deletedAt", tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt, studyRoutineId" });
    this.version(8).stores({ tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt, studyRoutineId, recurrenceTaskId" });
    this.version(9).stores({});
    this.version(10).stores({}).upgrade(async (tx) => { await tx.table("recurrences").toCollection().modify((r: LessonRecurrence & { dayOfWeek?: number; startTime?: string; endTime?: string; frequency?: LessonFrequency }) => { if (!r.schedules || !r.schedules.length) r.schedules = [{ dayOfWeek: r.dayOfWeek ?? 1, startTime: r.startTime ?? "17:00", endTime: r.endTime ?? "18:00", frequency: r.frequency ?? "weekly" }]; delete r.dayOfWeek; delete r.startTime; delete r.endTime; delete r.frequency; }); });
    this.version(11).stores({ pendingAssignments: "++id, subjectId, recurrenceId, createdAt" });
    this.version(12).stores({
      library: "++id, subjectId, kind, title, deletedAt, inRepertoire, nextReviewAt",
      performances: "++id, date, subjectId, deletedAt",
      performanceItems: "++id, eventId, itemId, [eventId+itemId]",
    });
  }
}

export const db = new VirtuosoDB();
