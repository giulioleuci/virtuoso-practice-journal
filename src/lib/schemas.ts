import type { StudyAdaptivity, StudyGroup } from "@/domain/ports/studyRoutine";
/** Centralized Zod schemas shared across forms. */
import { z } from "zod";
import { TASK_IMPORTANCE } from "@/domain/entities/task";
import { BPM_MIN, BPM_MAX, NOTE_VALUES } from "@/domain/constants/noteValues";

export const noteValSchema = z.enum(NOTE_VALUES);
export const bpmSchema = z.number().int().min(BPM_MIN).max(BPM_MAX);
export const ratingSchema = z.number().int().min(1).max(5);

export const tempoStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), value: z.number().int().positive().finite(), noteVal: noteValSchema }),
  z.object({ kind: z.literal("percent"), value: z.number().positive().finite() }),
]);
export const tempoRuleSchema = z.object({
  enabled: z.boolean(), successes: z.number().int().positive(), window: z.number().int().positive().optional(),
  minConfidence: ratingSchema, increase: tempoStepSchema,
  decrease: z.object({ failures: z.number().int().positive(), step: tempoStepSchema }).optional(),
}).refine(v => v.window === undefined || v.window >= v.successes, { path: ["window"], message: "Window must be at least the required successes" })
  .refine(v => v.decrease?.step.kind !== "percent" || v.decrease.step.value < 100, { path: ["decrease"], message: "Decrease must be below 100%" });
export const tempoProgressionRefSchema = z.object({ id: z.number().int().positive(), cycle: z.number().int().positive(), minConfidence: ratingSchema });
export const tempoProgressionSchema = z.object({
  id: z.number().int().positive(), owner: z.object({ kind: z.enum(["routine", "recurrence"]), id: z.number().int().positive() }),
  context: z.object({ itemId: z.number().int().positive(), segmentId: z.number().int().positive().optional(), layers: z.array(z.string()), techniques: z.array(z.number().int().positive()) }),
  contextKey: z.string(), tempo: z.object({ bpm: bpmSchema, noteVal: noteValSchema }),
  cycle: z.number().int().positive(), startedAt: z.number().finite().nonnegative(), ruleRevision: z.number().int().positive(),
});

export const segmentEntrySchema = z.object({
  progression: tempoProgressionRefSchema.optional(),
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
  notes: z.string().max(2000).optional(),
  targetBpm: bpmSchema.optional(),
  targetNoteVal: noteValSchema.optional(),
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
  importance: z.enum(TASK_IMPORTANCE).optional(),
}).refine(
  (v) => {
    // Mutual exclusivity: collection ⇒ no item/segments; segments ⇒ requires item
    const hasSegments = v.plan.some((e) => e.segmentId !== undefined);
    if (v.collectionId && (v.itemId || hasSegments)) return false;
    if (hasSegments && !v.itemId && v.linkType !== "free") return false;
    return true;
  },
  { message: "Invalid link: collection excludes item; segments require an item" },
);
export type TaskInput = z.infer<typeof taskInputSchema>;

export const colorKeySchema = z.enum(["terracotta", "sage", "gold", "blue", "plum", "coral", "amber", "teal", "indigo", "slate"]);
export const libraryKindSchema = z.enum(["piece", "study", "technique", "exercise", "theory"]);

export const collectionKindSchema = z.enum(["manual", "collection"]);
const completeTempo = (v: { targetBpm?: number; noteVal?: string }) => (v.targetBpm === undefined) === (v.noteVal === undefined);

export const libraryItemInputSchema = z.object({
  subjectId: z.number().int().positive(),
  kind: libraryKindSchema,
  title: z.string().trim().min(1).max(140),
  composer: z.string().trim().max(120).optional(),
  catalog: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  startBpm: bpmSchema.optional(),
  targetBpm: bpmSchema.optional(),
  noteVal: noteValSchema.optional(),
  techniqueIds: z.array(z.number().int().positive()).optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
}).refine(completeTempo, { path: ["targetBpm"], message: "BPM and note value must be set together" });

export const segmentInputSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().min(1).max(140),
  position: z.number().int().nonnegative(),
  barStart: z.number().int().nonnegative().optional(),
  barEnd: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional(),
  targetBpm: bpmSchema.optional(),
  noteVal: noteValSchema.optional(),
  layers: z.array(z.string()),
  techniqueIds: z.array(z.number().int().positive()).optional(),
}).refine(completeTempo, { path: ["targetBpm"], message: "BPM and note value must be set together" })
  .refine(v => (v.barStart === undefined && v.barEnd === undefined) || (v.barStart !== undefined && v.barEnd !== undefined && v.barEnd >= v.barStart), { path: ["barEnd"], message: "Specify a complete, ordered bar range" });

export const collectionLinkInputSchema = z.object({
  reference: z.string().trim().max(120).optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
}).refine(v => v.pageEnd === undefined || (v.pageStart !== undefined && v.pageEnd >= v.pageStart), { path: ["pageEnd"], message: "Specify an ordered page range" });

export const collectionInputSchema = z.object({
  kind: collectionKindSchema,
  name: z.string().trim().min(1).max(120),
  composer: z.string().trim().max(120).optional(),
  catalog: z.string().trim().max(60).optional(),
  edition: z.string().trim().max(120).optional(),
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
  combine: z.boolean().optional(),
  importance: z.enum(TASK_IMPORTANCE).optional(),
});
export type StudyGroupInput = StudyGroup;

export const studyRoutineConfigSchema = z.object({
  tempoRule: tempoRuleSchema.optional(),
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
  tempoRule?: import("@/domain/entities/tempoProgression").TempoProgressionRule;
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
