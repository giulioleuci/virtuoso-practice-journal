import type { Assignment } from "@/domain/entities/lesson";
import type { HelpRequest } from "@/domain/ports/helpRequest";

/**
 * Application-facing read and invalidation boundary for presentation adapters.
 * Infrastructure may use Dexie to implement this port; callers never receive a
 * table, collection, or persistence query object.
 */
export interface PresentationReadPort {
  read<T>(operation: string, parameters?: readonly unknown[]): Promise<T>;
  assignmentsForLesson(lessonId?: number): Promise<Assignment[]>;
  openHelpRequestCount(): Promise<number>;
  subscribe(listener: () => void): () => void;
}

export type { Assignment, HelpRequest };
