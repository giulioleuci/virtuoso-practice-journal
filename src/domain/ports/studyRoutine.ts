export type StudyPoolEntry =
  | { type: "item"; id: number }
  | { type: "segment"; id: number }
  | { type: "collection"; id: number };

export interface StudyGroup {
  id: string;
  name: string;
  pool: StudyPoolEntry[];
  /** Optional per-group weekly repetition cap, overriding the routine cap. */
  repetitionCap?: number;
  /** Fold everything the group draws on a day into one task whose sections span several library items. */
  combine?: boolean;
  /** Importance given to every task the group generates. */
  importance?: import("../entities/task").TaskImportance;
}

/** How strongly the draw favours the entries you feel least sure about. */
export type StudyAdaptivity = "uniform" | "balanced" | "aggressive";

/** Practice history for one pool entry. */
export interface StudyPoolStat {
  /** Recency-weighted average confidence 1-5, or null when there is no history. */
  confidence: number | null;
  /** Local `YYYY-MM-DD` key of the last logged session, when known. */
  lastPracticed?: string;
  sessions: number;
}

export interface StudyRoutine {
  tempoRule?: import("@/domain/entities/tempoProgression").TempoProgressionRule;
  tempoRuleRevision?: number;
  id: number;
  name?: string;
  parentTaskId?: number;
  subjectId: number;
  groups: StudyGroup[];
  matrix: Record<string, Record<string, number>>;
  weeksAhead: number;
  repetitionCap: number;
  /** @deprecated Legacy boolean flag; superseded by `adaptivity`. */
  useSpacedRepetition?: boolean;
  adaptivity?: StudyAdaptivity;
  /** Avoid drawing the same entry two days in a row. */
  avoidBackToBack?: boolean;
  startDate: string;
  createdAt: number;
  deletedAt?: number;
}

export type StudyRoutineInput = Omit<StudyRoutine, "id" | "createdAt" | "deletedAt">;

export interface ResolvedStudyPoolItem {
  key: string;
  type: "item" | "segment" | "collection";
  title: string;
  parentTitle?: string;
  itemId?: number;
  segmentIds?: number[];
  collectionId?: number;
  linkType: "item" | "collection" | "free";
  plan?: import("../entities/common").SegmentEntry[];
  sections?: ResolvedStudyPoolItem[];
}

export interface StudyRoutineGenerationPort {
  createRoutine(input: StudyRoutineInput, createdAt: number): Promise<StudyRoutine>;
  resolvePool(entries: StudyPoolEntry[]): Promise<Map<string, ResolvedStudyPoolItem>>;
  stats(entries: StudyPoolEntry[]): Promise<Map<string, StudyPoolStat>>;
  weekStartsOn(): Promise<number>;
  persistTasks(tasks: Omit<import("../entities/task").Task, "id">[]): Promise<void>;
}

export interface StudyRoutinePort {
  create(input: StudyRoutineInput): Promise<number>;
  regenerateFromDate(routine: StudyRoutine, fromDate: string): Promise<void>;
  update(id: number, patch: Partial<StudyRoutine>): Promise<void>;
  remove(id: number): Promise<void>;
}
