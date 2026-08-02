/** Centralized Zod schemas shared across forms. */
import { z } from "zod";

export const noteValSchema = z.enum(["half", "quarter", "eighth", "sixteenth"]);
export const sessionQualitySchema = z.enum(["hard", "improve", "well", "great"]);
export const bpmSchema = z.number().int().min(20).max(400);
export const repsSchema = z.number().int().min(0).max(9999);
export const confidenceSchema = z.number().int().min(1).max(5);

export const sessionInputSchema = z.object({
  bpmReached: bpmSchema.optional(),
  noteVal: noteValSchema.optional(),
  reps: repsSchema.optional(),
  confidence: confidenceSchema.optional(),
  quality: sessionQualitySchema,
  notes: z.string().trim().max(2000).optional(),
  layersUsed: z.array(z.string()).optional(),
  techniquesUsed: z.array(z.number()).optional(),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

export const taskLinkTypeSchema = z.enum(["free", "item", "collection"]);

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjectId: z.number().int().positive(),
  linkType: taskLinkTypeSchema.optional(),
  itemId: z.number().int().positive().optional(),
  segmentIds: z.array(z.number().int().positive()).optional(),
  collectionId: z.number().int().positive().optional(),
  targetBpm: bpmSchema.optional(),
  noteVal: noteValSchema.optional(),
  layers: z.array(z.string()).optional(),
  techniqueIds: z.array(z.number()).optional(),
  executionNotes: z.string().trim().max(2000).optional(),
}).refine(
  (v) => {
    // Mutual exclusivity: collection ⇒ no item/segments; segments ⇒ requires item
    if (v.collectionId && (v.itemId || v.segmentIds?.length)) return false;
    if (v.segmentIds?.length && !v.itemId) return false;
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
});
export type StudyGroupInput = z.infer<typeof studyGroupSchema>;

export const studyRoutineConfigSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subjectId: z.number().int().positive(),
  groups: z.array(studyGroupSchema).min(1),
  matrix: z.record(z.string(), z.record(z.string(), z.number().int().min(0))),
  weeksAhead: z.number().int().min(1).max(53),
  repetitionCap: z.number().int().min(1),
  useSpacedRepetition: z.boolean(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export interface StudyRoutineConfig {
  name: string;
  subjectId: number;
  groups: StudyGroupInput[];
  matrix: Record<string, Record<string, number>>;
  weeksAhead: number;
  repetitionCap: number;
  useSpacedRepetition: boolean;
  startDate: string;
}

/** Tiny helper: returns string[] of error messages (empty = valid). */
export function flattenErrors<T>(res: z.SafeParseReturnType<unknown, T>): string[] {
  if (res.success) return [];
  return res.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`);
}
