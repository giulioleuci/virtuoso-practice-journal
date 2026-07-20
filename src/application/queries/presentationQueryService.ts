import type { PresentationReadPort } from "./presentationReadPort";
import type { Assignment } from "@/domain/entities/lesson";
import type { PendingAssignment } from "@/domain/ports/pendingAssignment";

/** Typed application query service used by React presentation adapters. */
export class PresentationQueryService {
  constructor(private readonly reads: PresentationReadPort) {}

  subscribe(listener: () => void): () => void {
    return this.reads.subscribe(listener);
  }

  execute<T>(operation: string, ...parameters: readonly unknown[]): Promise<T> {
    return this.reads.read<T>(operation, parameters);
  }

  assignmentsForLesson(lessonId?: number): Promise<Assignment[]> {
    return this.reads.assignmentsForLesson(lessonId);
  }

  pendingAssignmentsForSubject(subjectId?: number, recurrenceId?: number): Promise<PendingAssignment[]> {
    return this.reads.pendingAssignmentsForSubject(subjectId, recurrenceId);
  }

  openHelpRequestCount(): Promise<number> {
    return this.reads.openHelpRequestCount();
  }
}

let configuredQueries: PresentationQueryService | undefined;

/** Called only by the composition root. Keeps infrastructure out of UI modules. */
export function configurePresentationQueries(reads: PresentationReadPort): void {
  configuredQueries = new PresentationQueryService(reads);
}

export function presentationQueries(): PresentationQueryService {
  if (!configuredQueries) throw new Error("Presentation queries were not configured");
  return configuredQueries;
}
