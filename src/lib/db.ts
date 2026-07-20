import Dexie, { type Table } from "dexie";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { TheoryLayer } from "@/domain/constants/theoryLayers";
import type { ColorKey, Draft, Lang, LibraryKind, NoteVal, ReminderFreq, SegmentMetric, SessionQuality, Subject, SubjectType, Technique } from "@/domain/entities/common";
import type { Collection, CollectionItem } from "@/domain/entities/collection";
import type { Assignment, Lesson, LessonFrequency, LessonRecurrence, LessonScheduleSlot, LessonSnapshot } from "@/domain/entities/lesson";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Profile } from "@/domain/entities/profile";
import type { Session, SessionSnapshot } from "@/domain/entities/session";
import type { Task, TaskLinkType, TaskRecurrence } from "@/domain/entities/task";

export { THEORY_LAYERS };
export type { TheoryLayer } from "@/domain/constants/theoryLayers";
export type { ColorKey, Draft, Lang, LibraryKind, NoteVal, ReminderFreq, SegmentMetric, SessionQuality, Subject, SubjectType, Technique } from "@/domain/entities/common";
export type { Collection, CollectionItem } from "@/domain/entities/collection";
export type { Assignment, Lesson, LessonFrequency, LessonRecurrence, LessonScheduleSlot, LessonSnapshot } from "@/domain/entities/lesson";
export type { LibraryItem, Segment } from "@/domain/entities/library";
export type { Profile } from "@/domain/entities/profile";
export type { Session, SessionSnapshot } from "@/domain/entities/session";
export type { Task, TaskLinkType, TaskRecurrence } from "@/domain/entities/task";

export interface HelpRequest {
  id: number;
  sessionId?: number;
  taskId?: number;
  itemId?: number;
  question: string;
  answer?: string;
  answeredAt?: number;
  resolved: boolean;
  createdAt: number;
}

/** Draft homework captured live during a lesson, before the lesson is recorded. */
export interface PendingAssignment {
  id?: number;
  subjectId: number;
  recurrenceId?: number;
  text: string;
  createdAt: number;
}

export type StudyPoolEntry =
  | { type: "item"; id: number }
  | { type: "segment"; id: number }
  | { type: "collection"; id: number };

export interface StudyGroup {
  id: string;
  name: string;
  pool: StudyPoolEntry[];
}

export interface StudyRoutine {
  id: number;
  name?: string;
  parentTaskId?: number;
  subjectId: number;
  groups: StudyGroup[];
  /** dayOfWeek (0=Sun…6=Sat) → { groupId → itemCount } */
  matrix: Record<string, Record<string, number>>;
  weeksAhead: number;
  repetitionCap: number;
  useSpacedRepetition: boolean;
  startDate: string;
  createdAt: number;
  deletedAt?: number;
}

/** Shape accepted on insert: the auto-increment `id` is assigned by Dexie. */
export type Draft<T extends { id?: number }> = Omit<T, "id"> & { id?: number };

class VirtuosoDB extends Dexie {
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
  declare assignments: Table<Assignment, number, Draft<Assignment>>;
  declare collections: Table<Collection, number, Draft<Collection>>;
  declare collectionItems: Table<CollectionItem, number, Draft<CollectionItem>>;
  declare studyRoutines: Table<StudyRoutine, number, Draft<StudyRoutine>>;
  declare pendingAssignments: Table<PendingAssignment, number, Draft<PendingAssignment>>;

  constructor() {
    super("virtuoso");
    this.version(1).stores({
      profile: "id",
      subjects: "++id, name, type",
      library: "++id, subjectId, kind, title",
      segments: "++id, itemId",
      tasks: "++id, date, subjectId, itemId, done",
      sessions: "++id, taskId, date",
      helpRequests: "++id, sessionId, itemId, resolved",
      recurrences: "++id, subjectId",
      lessons: "++id, recurrenceId, subjectId, date",
      assignments: "++id, lessonId, transformed",
    });
    this.version(2).stores({
      techniques: "++id, subjectId, name",
    });
    this.version(3).stores({
      subjects: "++id, name, type, deletedAt",
      library: "++id, subjectId, kind, title, deletedAt",
      segments: "++id, itemId, deletedAt",
      tasks: "++id, date, subjectId, itemId, done, deletedAt",
      recurrences: "++id, subjectId, deletedAt",
      techniques: "++id, subjectId, name, deletedAt",
    });
    // v4: repertoire collections (many-to-many)
    this.version(4).stores({
      collections: "++id, name, composer, defaultSubjectId, deletedAt",
      collectionItems: "++id, collectionId, itemId, [collectionId+itemId]",
    });
    // v5: tasks support multi-segment scope and collection linking
    this.version(5).stores({
      tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt",
    }).upgrade(async (tx) => {
      await tx.table("tasks").toCollection().modify((t: Task) => {
        const legacy = (t as Task & { segmentId?: number }).segmentId;
        if (legacy && !t.segmentIds?.length) t.segmentIds = [legacy];
        delete (t as Task & { segmentId?: number }).segmentId;
        if (!t.linkType) t.linkType = t.itemId ? "item" : "free";
      });
    });
    // v6: collections become kind-specific (extended beyond repertoire)
    this.version(6).stores({
      collections: "++id, name, kind, composer, defaultSubjectId, deletedAt",
    }).upgrade(async (tx) => {
      await tx.table("collections").toCollection().modify((c: Collection) => {
        if (!c.kind) c.kind = "repertoire";
      });
    });
    // v7: study routines + studyRoutineId index on tasks
    this.version(7).stores({
      studyRoutines: "++id, subjectId, deletedAt",
      tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt, studyRoutineId",
    });
    // v8: index recurrenceTaskId to support querying recurring task series
    this.version(8).stores({
      tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt, studyRoutineId, recurrenceTaskId",
    });
    // v9: color field on subjects (no store change needed — just data model extension)
    this.version(9).stores({});
    // v10: lesson recurrences support multiple weekday slots
    this.version(10).stores({}).upgrade(async (tx) => {
      await tx.table("recurrences").toCollection().modify((r: LessonRecurrence & {
        dayOfWeek?: number; startTime?: string; endTime?: string; frequency?: LessonFrequency;
      }) => {
        if (!r.schedules || !r.schedules.length) {
          r.schedules = [{
            dayOfWeek: r.dayOfWeek ?? 1,
            startTime: r.startTime ?? "17:00",
            endTime: r.endTime ?? "18:00",
            frequency: r.frequency ?? "weekly",
          }];
        }
        delete r.dayOfWeek;
        delete r.startTime;
        delete r.endTime;
        delete r.frequency;
      });
    });
    // v11: pending (draft) homework assignments captured before a lesson is logged
    this.version(11).stores({
      pendingAssignments: "++id, subjectId, recurrenceId, createdAt",
    });
  }
}

export const db = new VirtuosoDB();
