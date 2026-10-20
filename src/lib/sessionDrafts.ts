import { z } from "zod";
import { segmentMarkSchema } from "@/lib/schemas";
import type { SegmentMark } from "@/domain/entities/common";
import type { AudioDraft } from "@/domain/ports/audio";

export interface SessionDraft {
  marks: SegmentMark[];
  notes: string;
  clips: AudioDraft[];
  needHelp: boolean;
  helpText: string;
  subjectId?: number;
  itemId?: number;
  title?: string;
  date?: string;
}

const draftSchema = z.object({
  marks: z.array(segmentMarkSchema.extend({ bpm: z.number().optional() })),
  notes: z.string(),
  clips: z.array(z.object({ uid: z.string(), mimeType: z.string(), durationMs: z.number().nonnegative(), segmentId: z.number().optional(), title: z.string().optional() })),
  needHelp: z.boolean(),
  helpText: z.string(),
  subjectId: z.number().optional(),
  itemId: z.number().optional(),
  title: z.string().optional(),
  date: z.string().optional(),
});
/** Whether the musician has entered anything worth discarding: ratings, notes, recordings, a question or a title. Tempos, layers and techniques seeded from the plan do not count. */
export const draftHasContent = (d: SessionDraft): boolean =>
  !!(d.notes.trim() || d.clips.length || d.needHelp || d.title?.trim() || d.marks.some((m) => m.confidence || m.mood || m.focus));
export const sessionDraftKey = (scope: string) => `virtuoso-session-${scope}`;
export const taskDraftScope = (task: { id?: number; createdAt: number }) => `task-${task.id}-${task.createdAt}`;

export function readSessionDraft(scope: string): SessionDraft | undefined {
  try {
    const result = draftSchema.safeParse(JSON.parse(localStorage.getItem(sessionDraftKey(scope)) ?? "null"));
    return result.success ? result.data as SessionDraft : undefined;
  } catch { return undefined; }
}

/** An explicit data wipe must also remove unsaved personal notes and old rating drafts. */
export function clearSessionDrafts() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("virtuoso-session-") || key.startsWith("virtuoso-marks-")) localStorage.removeItem(key);
  }
}
