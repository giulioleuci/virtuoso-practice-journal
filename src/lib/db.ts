import Dexie, { type Table } from "dexie";

export type Lang = "en" | "it" | "es" | "de";
export type SubjectType = "instrument" | "theory" | "composition" | "other";

export const THEORY_LAYERS = ["conceptual", "analytical", "aural", "compositional", "reading"] as const;
export type TheoryLayer = typeof THEORY_LAYERS[number];
export type LibraryKind = "repertoire" | "manual" | "technique" | "theory";
export type NoteVal = "half" | "quarter" | "eighth" | "sixteenth";
export type PracticeStatus = "in_study" | "maintenance" | "pause";
export type SessionQuality = "hard" | "improve" | "well" | "great";

export interface SegmentMetric {
  confidence?: number;
  quality?: SessionQuality;
  bpmReached?: number;
  reps?: number;
}
export type ColorKey = "terracotta" | "sage" | "gold" | "blue" | "plum" | "coral" | "amber" | "teal" | "indigo" | "slate";
export type ReminderFreq = "daily" | "weekdays" | "custom";

export interface Profile {
  id: "me";
  name: string;
  lang: Lang;
  reminderTime: string;          // "HH:MM"
  reminderFreq: ReminderFreq;
  reminderDays: number[];        // 0-6 if custom
  reminderEnabled?: boolean;     // undefined = enabled (back-compat)
  lateRecoveryDays: number;
  carryoverDays?: number;        // how many past days to surface uncompleted tasks from
  graceDay: boolean;
  groupByPhase: boolean;
  /** When true, the inspirational quote on the diary hero card is hidden. */
  hideHeroQuote?: boolean;
  onboarded: boolean;
  introSeen?: boolean;
  createdAt: number;
}

export interface Subject {
  id?: number;
  name: string;
  type: SubjectType;
  layers?: string[];
  color?: ColorKey;
  /** Optional custom color (hex like "#aabbcc"), overrides preset `color` when set. */
  customColor?: string;
  createdAt: number;
  deletedAt?: number;
}

export interface Technique {
  id: number;
  subjectId: number;
  name: string;
  createdAt: number;
  deletedAt?: number;
}

export interface LibraryItem {
  id?: number;
  subjectId: number;
  kind: LibraryKind;
  title: string;
  composer?: string;
  status?: PracticeStatus;
  startBpm?: number;
  targetBpm?: number;
  noteVal?: NoteVal;
  techniqueIds?: number[];
  totalExercises?: number;
  currentExercise?: number;
  mastery?: { conceptual: number; analytical: number; aural: number; compositional: number; reading?: number };
  tags?: string[];
  createdAt: number;
  deletedAt?: number;
}

export interface Segment {
  id: number;
  itemId: number;
  label: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers: string[];
  techniqueIds?: number[];
  createdAt: number;
  deletedAt?: number;
}

export interface TaskRecurrence {
  kind: "weekdays" | "interval";
  days?: number[];
  everyXDays?: number;
  startDate: string;
  endDate?: string;
  occurrences?: number;
}

/**
 * A task is mutually-exclusively linked to ONE of:
 *  - "free":       no library link
 *  - "item":       a single LibraryItem (optionally narrowed to one or more segments)
 *  - "collection": a whole Collection (label/grouping; no per-item iteration)
 */
export type TaskLinkType = "free" | "item" | "collection";

export interface Task {
  id?: number;
  date: string;
  subjectId: number;
  linkType?: TaskLinkType;        // optional for legacy rows; treat missing as inferred
  itemId?: number;
  /** Multi-segment scope when linkType==="item". */
  segmentIds?: number[];
  /** Set only when linkType==="collection". */
  collectionId?: number;
  title: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers?: string[];
  techniqueIds?: number[];
  done: boolean;
  skipped?: boolean;
  executionNotes?: string;
  recurrenceTaskId?: number;
  recurrence?: TaskRecurrence;
  studyRoutineId?: number;
  createdAt: number;
  deletedAt?: number;
}

/** Immutable copy of context at the moment a Session was saved. */
export interface SessionSnapshot {
  taskTitle: string;
  subjectName: string;
  itemTitle?: string;
  itemComposer?: string;
  /** Segments included in the task scope (id + label for historical rendering). */
  segments?: { id: string; label: string }[];
  /** Name of the collection if the task was collection-linked. */
  collectionName?: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers?: string[];
  techniqueNames?: string[];
}

export interface Session {
  id: number;
  taskId: number;
  date: string;
  bpmReached?: number;
  noteVal?: NoteVal;
  reps?: number;
  quality?: SessionQuality;
  confidence?: number;
  notes?: string;
  layersUsed?: string[];
  techniquesUsed?: number[];
  /** Per-layer scores 0-100 for theory sessions. */
  layerScores?: Record<string, number>;
  /** Per-technique scores 0-100. */
  techniqueScores?: Record<number, number>;
  /** Per-segment metrics when session was logged in granular mode. */
  segmentMetrics?: Record<string, SegmentMetric>;
  /** Denormalized snapshot — the source of truth for historical display. */
  snapshot?: SessionSnapshot;
  createdAt: number;
}

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

export interface LessonRecurrence {
  id?: number;
  subjectId: number;
  teacher: string;
  frequency: "weekly" | "biweekly" | "monthly";
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  color: ColorKey;
  createdAt: number;
  deletedAt?: number;
}

/** Immutable copy of lesson context. */
export interface LessonSnapshot {
  subjectName: string;
  teacher?: string;
  frequency?: LessonRecurrence["frequency"];
}

export interface Lesson {
  id?: number;
  recurrenceId?: number;
  subjectId: number;
  date: string;
  notes?: string;
  piecesPlayed?: number[];
  /** Titles of pieces played, snapshot at save time. */
  piecesPlayedTitles?: string[];
  snapshot?: LessonSnapshot;
  createdAt: number;
}

export interface Assignment {
  id: number;
  lessonId: number;
  text: string;
  transformed: boolean;
  ignored?: boolean;
  taskId?: number;
  createdAt: number;
}

export interface Collection {
  id?: number;
  /** Library kind this collection groups. Each collection is kind-specific. */
  kind: LibraryKind;
  name: string;
  composer?: string;
  catalog?: string;
  notes?: string;
  color?: ColorKey;
  defaultSubjectId?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface CollectionItem {
  id: number;
  collectionId: number;
  itemId: number;
  position?: number;
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
  }
}

export const db = new VirtuosoDB();
