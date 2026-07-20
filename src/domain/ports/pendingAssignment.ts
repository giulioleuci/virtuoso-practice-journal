export interface PendingAssignment {
  id?: number;
  subjectId: number;
  recurrenceId?: number;
  text: string;
  createdAt: number;
}

export interface PendingAssignmentPort {
  add(subjectId: number, text: string, recurrenceId?: number): Promise<number>;
  remove(id: number): Promise<void>;
  update(id: number, text: string): Promise<void>;
  removeMany(ids: number[]): Promise<void>;
  listFor(subjectId: number, recurrenceId?: number): Promise<PendingAssignment[]>;
}
