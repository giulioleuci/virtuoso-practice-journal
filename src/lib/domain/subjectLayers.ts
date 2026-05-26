/** Pure resolution of the layer set for a subject. */
import { THEORY_LAYERS, type Subject } from "@/lib/db";

/**
 * The practice layers available for a subject. Theory subjects always use the
 * fixed THEORY_LAYERS; other subjects use their configured `layers`.
 */
export function getSubjectLayers(subject: Subject | undefined | null): string[] {
  return subject?.type === "theory" ? [...THEORY_LAYERS] : (subject?.layers ?? []);
}
