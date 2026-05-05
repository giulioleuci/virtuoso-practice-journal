import Dexie, { type Table } from "dexie";

export type Lang = "en" | "it" | "es" | "de";
export type SubjectType = "instrument" | "theory" | "composition" | "other";
export type LibraryKind = "repertoire" | "manual" | "technique" | "theory";
export type NoteVal = "half" | "quarter" | "eighth" | "sixteenth";
export type PracticeStatus = "in_study" | "maintenance" | "pause";
export type SessionQuality = "hard" | "well" | "great";
export type ColorKey = "terracotta" | "sage" | "gold" | "blue" | "plum";
export type ReminderFreq = "daily" | "weekdays" | "custom";

export interface Profile {
  id: "me";
  name: string;
  lang: Lang;
  reminderTime: string;          // "HH:MM"
  reminderFreq: ReminderFreq;
  reminderDays: number[];        // 0-6 if custom
  lateRecoveryDays: number;
  graceDay: boolean;
  groupByPhase: boolean;
  onboarded: boolean;
  createdAt: number;
}

export interface Subject {
  id?: number;
  name: string;
  type: SubjectType;
  layers?: string[];             // allowed practice layers, defined per subject
  createdAt: number;
}

export interface Technique {
  id?: number;
  subjectId: number;
  name: string;
  createdAt: number;
}

export interface LibraryItem {
  id?: number;
  subjectId: number;
  kind: LibraryKind;
  title: string;
  composer?: string;             // composer / author (technique manuals)
  status?: PracticeStatus;       // repertoire
  startBpm?: number;             // technique
  targetBpm?: number;            // repertoire/manual/technique
  noteVal?: NoteVal;
  techniqueIds?: number[];       // associated techniques
  totalExercises?: number;       // manual
  currentExercise?: number;      // manual
  // theory mastery 0-100
  mastery?: { conceptual: number; analytical: number; aural: number; compositional: number };
  tags?: string[];
  createdAt: number;
}

export interface Segment {
  id?: number;
  itemId: number;
  label: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  confidence: number;            // 1-5
  layers: string[];              // values from owning subject's layers
  techniqueIds?: number[];
  createdAt: number;
}

export interface TaskRecurrence {
  kind: "weekdays" | "interval";
  days?: number[];               // 0-6, for "weekdays"
  everyXDays?: number;           // for "interval"
  startDate: string;             // YYYY-MM-DD
  endDate?: string;              // optional cap
  occurrences?: number;          // optional cap
}

export interface Task {
  id?: number;
  date: string;                  // YYYY-MM-DD
  subjectId: number;
  itemId?: number;
  segmentId?: number;
  title: string;
  targetBpm?: number;
  noteVal?: NoteVal;
  layers?: string[];             // selected practice layers
  techniqueIds?: number[];       // selected techniques
  done: boolean;
  skipped?: boolean;
  recurrenceTaskId?: number;     // points to template task id
  recurrence?: TaskRecurrence;   // present on template tasks
  createdAt: number;
}

export interface Session {
  id?: number;
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
  createdAt: number;
}

export interface HelpRequest {
  id?: number;
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
  dayOfWeek: number;             // 0-6
  startTime: string;             // HH:MM
  endTime: string;
  startDate: string;             // YYYY-MM-DD
  endDate?: string;
  color: ColorKey;
  createdAt: number;
}

export interface Lesson {
  id?: number;
  recurrenceId?: number;
  subjectId: number;
  date: string;
  notes?: string;
  piecesPlayed?: number[];       // itemIds
  createdAt: number;
}

export interface Assignment {
  id?: number;
  lessonId: number;
  text: string;
  transformed: boolean;
  taskId?: number;               // populated when transformed
  createdAt: number;
}

class VirtuosoDB extends Dexie {
  profile!: Table<Profile, string>;
  subjects!: Table<Subject, number>;
  techniques!: Table<Technique, number>;
  library!: Table<LibraryItem, number>;
  segments!: Table<Segment, number>;
  tasks!: Table<Task, number>;
  sessions!: Table<Session, number>;
  helpRequests!: Table<HelpRequest, number>;
  recurrences!: Table<LessonRecurrence, number>;
  lessons!: Table<Lesson, number>;
  assignments!: Table<Assignment, number>;

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
  }
}

export const db = new VirtuosoDB();

export async function exportAll(): Promise<string> {
  const dump: Record<string, unknown> = {};
  for (const tbl of db.tables) dump[tbl.name] = await tbl.toArray();
  return JSON.stringify({ version: 1, exportedAt: Date.now(), data: dump }, null, 2);
}

export async function importAll(json: string) {
  const parsed = JSON.parse(json);
  await db.transaction("rw", db.tables, async () => {
    for (const tbl of db.tables) {
      await tbl.clear();
      const rows = parsed.data?.[tbl.name];
      if (Array.isArray(rows) && rows.length) await tbl.bulkAdd(rows);
    }
  });
}

export async function wipeAll() {
  await db.transaction("rw", db.tables, async () => {
    for (const tbl of db.tables) await tbl.clear();
  });
}
