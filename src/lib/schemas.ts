import type { StudyAdaptivity, StudyGroup } from "@/domain/ports/studyRoutine";
/** Centralized Zod schemas shared across forms. */
import { z } from "zod";
import { NOTE_VALUES } from "@/domain/constants/noteValues";

export const noteValSchema = z.enum(NOTE_VALUES);
export const bpmSchema = z.number().int().min(20).max(400);
export const ratingSchema = z.number().int().min(1).max(5);

export const segmentEntrySchema = z.object({
  segmentId: z.number().int().positive().optional(),
  bpm: bpmSchema.optional(),
  noteVal: noteValSchema.optional(),
  layers: z.array(z.string()),
  techniques: z.array(z.number()),
});

export const segmentMarkSchema = segmentEntrySchema.extend({
  confidence: ratingSchema.optional(),
  mood: ratingSchema.optional(),
  focus: ratingSchema.optional(),
  targetBpm: bpmSchema.optional(),
});

const oneEntryPerSection = (marks: { segmentId?: number }[]) => new Set(marks.map((m) => m.segmentId ?? "whole")).size === marks.length;

/** Edits of stored sessions: historical marks may lack ratings. */
export const sessionInputSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  marks: z.array(segmentMarkSchema).refine(oneEntryPerSection, "Each section appears once"),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

/** New sessions: at least one studied entry, each with a confidence rating; mood and focus are optional. */
export const newSessionInputSchema = sessionInputSchema.extend({
  marks: z.array(segmentMarkSchema.required({ confidence: true })).min(1).refine(oneEntryPerSection, "Each section appears once"),
});

export const taskLinkTypeSchema = z.enum(["free", "item", "collection"]);

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjectId: z.number().int().positive(),
  linkType: taskLinkTypeSchema.optional(),
  itemId: z.number().int().positive().optional(),
  collectionId: z.number().int().positive().optional(),
  plan: z.array(segmentEntrySchema),
  executionNotes: z.string().trim().max(2000).optional(),
}).refine(
  (v) => {
    // Mutual exclusivity: collection ⇒ no item/segments; segments ⇒ requires item
    const hasSegments = v.plan.some((e) => e.segmentId !== undefined);
    if (v.collectionId && (v.itemId || hasSegments)) return false;
    if (hasSegments && !v.itemId) return false;
    return true;
  },
  { message: "Invalid link: collection excludes item; segments require an item" },
);
export type TaskInput = z.infer<typeof taskInputSchema>;

export const colorKeySchema = z.enum(["terracotta", "sage", "gold", "blue", "plum", "coral", "amber", "teal", "indigo", "slate"]);
export const libraryKindSchema = z.enum(["repertoire", "manual", "technique", "theory"]);

export const collectionInputSchema = z.object({
  kind: libraryKindSchema,
  name: z.string().trim().min(1).max(120),
  composer: z.string().trim().max(120).optional(),
  catalog: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  color: colorKeySchema.optional(),
  defaultSubjectId: z.number().int().positive().optional(),
});
export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const studyGroupSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80),
  pool: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("item"), id: z.number().int().positive() }),
    z.object({ type: z.literal("segment"), id: z.number().int().positive() }),
    z.object({ type: z.literal("collection"), id: z.number().int().positive() }),
  ])),
  repetitionCap: z.number().int().min(1).optional(),
});
export type StudyGroupInput = StudyGroup;

export const studyRoutineConfigSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subjectId: z.number().int().positive(),
  groups: z.array(studyGroupSchema).min(1),
  matrix: z.record(z.string(), z.record(z.string(), z.number().int().min(0))),
  weeksAhead: z.number().int().min(1).max(53),
  repetitionCap: z.number().int().min(1),
  useSpacedRepetition: z.boolean().optional(),
  adaptivity: z.enum(["uniform", "balanced", "aggressive"]).optional(),
  avoidBackToBack: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export interface StudyRoutineConfig {
  name: string;
  subjectId: number;
  groups: StudyGroupInput[];
  matrix: Record<string, Record<string, number>>;
  weeksAhead: number;
  repetitionCap: number;
  useSpacedRepetition?: boolean;
  adaptivity?: StudyAdaptivity;
  avoidBackToBack?: boolean;
  startDate: string;
}

/** Tiny helper: returns string[] of error messages (empty = valid). */
export function flattenErrors<T>(res: z.SafeParseReturnType<unknown, T>): string[] {
  if (res.success) return [];
  return res.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`);
}
