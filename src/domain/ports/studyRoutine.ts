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
  matrix: Record<string, Record<string, number>>;
  weeksAhead: number;
  repetitionCap: number;
  useSpacedRepetition: boolean;
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
  linkType: "item" | "collection";
}

export interface StudyRoutineGenerationPort {
  createRoutine(input: StudyRoutineInput, createdAt: number): Promise<StudyRoutine>;
  resolvePool(entries: StudyPoolEntry[]): Promise<Map<string, ResolvedStudyPoolItem>>;
  weights(entries: StudyPoolEntry[]): Promise<Map<string, number>>;
  weekStartsOn(): Promise<number>;
  persistTasks(tasks: Omit<import("../entities/task").Task, "id">[]): Promise<void>;
}

export interface StudyRoutinePort {
  create(input: StudyRoutineInput): Promise<number>;
  regenerateFromDate(routine: StudyRoutine, fromDate: string): Promise<void>;
  update(id: number, patch: Partial<StudyRoutine>): Promise<void>;
  remove(id: number): Promise<void>;
}
