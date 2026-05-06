/** Centralized Zod schemas shared across forms. */
import { z } from "zod";

export const noteValSchema = z.enum(["half", "quarter", "eighth", "sixteenth"]);
export const sessionQualitySchema = z.enum(["hard", "well", "great"]);
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

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjectId: z.number().int().positive(),
  itemId: z.number().int().positive().optional(),
  segmentId: z.number().int().positive().optional(),
  targetBpm: bpmSchema.optional(),
  noteVal: noteValSchema.optional(),
  layers: z.array(z.string()).optional(),
  techniqueIds: z.array(z.number()).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const colorKeySchema = z.enum(["terracotta", "sage", "gold", "blue", "plum"]);

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  composer: z.string().trim().max(120).optional(),
  catalog: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  color: colorKeySchema.optional(),
  defaultSubjectId: z.number().int().positive().optional(),
});
export type CollectionInput = z.infer<typeof collectionInputSchema>;

/** Tiny helper: returns string[] of error messages (empty = valid). */
export function flattenErrors<T>(res: z.SafeParseReturnType<unknown, T>): string[] {
  if (res.success) return [];
  return res.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`);
}
