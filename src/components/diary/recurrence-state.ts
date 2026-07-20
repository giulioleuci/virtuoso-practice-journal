import { schoolYearEnd } from "@/lib/recurrence";
import type { TaskRecurrence } from "@/lib/presentationQueries";

export type EndMode = "never" | "nextLesson" | "date" | "count";

export interface RecurrenceState {
  enabled: boolean;
  kind: "weekdays" | "interval";
  days: number[];
  everyX: number;
  startDate: string;
  endMode: EndMode;
  endDate: string;
  occurrences: number;
}

export function buildRecurrence(state: RecurrenceState, nextLessonDate?: string): TaskRecurrence | undefined {
  if (!state.enabled) return undefined;
  return {
    kind: state.kind,
    days: state.kind === "weekdays" ? [...state.days].sort() : undefined,
    everyXDays: state.kind === "interval" ? state.everyX : undefined,
    startDate: state.startDate,
    endDate:
      state.endMode === "date" && state.endDate
        ? state.endDate
        : state.endMode === "nextLesson" && nextLessonDate
        ? nextLessonDate
        : state.endMode === "never"
        ? schoolYearEnd(new Date())
        : undefined,
    occurrences: state.endMode === "count" ? state.occurrences : undefined,
  };
}
