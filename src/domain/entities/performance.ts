/** Concerts, exams and auditions a repertoire item can be prepared for. */
export type PerformanceKind = "concert" | "exam" | "audition";

export interface PerformanceEvent {
  id?: number;
  name: string;
  kind: PerformanceKind;
  /** Local `YYYY-MM-DD` day key. */
  date: string;
  subjectId?: number;
  venue?: string;
  notes?: string;
  createdAt: number;
  deletedAt?: number;
}

/** Join between a performance event and a library item in its programme. */
export interface PerformanceItem {
  id?: number;
  eventId: number;
  itemId: number;
  createdAt: number;
}
