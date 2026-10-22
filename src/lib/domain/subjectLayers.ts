import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { Subject } from "@/domain/entities/common";

/**
 * Configured work aspects; unconfigured theory subjects retain the original defaults.
 */
export function getSubjectLayers(subject: Pick<Subject, "type" | "layers"> | undefined | null): string[] {
  return subject?.layers ?? (subject?.type === "theory" ? [...THEORY_LAYERS] : []);
}

/** Only built-in theory keys are translated; custom names are stored as written. */
export function getSubjectLayerLabel(subject: Pick<Subject, "type"> | undefined, layer: string, t: (key: string) => string): string {
  return subject?.type === "theory" && THEORY_LAYERS.some(value => value === layer) ? t(`library.mastery.${layer}`) : layer;
}
