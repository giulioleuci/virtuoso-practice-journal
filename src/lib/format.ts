import type { NoteVal, SegmentEntry, SegmentMark } from "@/domain/entities/common";
import { NOTE_GLYPH } from "@/domain/constants/noteValues";
import { firstTempo } from "@/domain/logic/plan";
import { meanConfidence, topMark } from "@/domain/logic/sessionMetrics";

/** "♩ = 96" */
export const tempoLabel = (noteVal: NoteVal | undefined, bpm: number): string => `${NOTE_GLYPH[noteVal ?? "quarter"]} = ${bpm}`;

/** "★ 4" or "★ 3.5" for a mean confidence. */
export const confidenceLabel = (confidence: number): string => `★ ${Number.isInteger(confidence) ? confidence : confidence.toFixed(1)}`;

/** Target tempo of a task plan, when it has one. */
export function planTempoLabel(plan: SegmentEntry[]): string | undefined {
  const entry = firstTempo(plan);
  return entry?.bpm ? tempoLabel(entry.noteVal, entry.bpm) : undefined;
}

/** One-line result of a session: top tempo and mean confidence, e.g. "♩ = 96 · ★ 4". */
export function sessionLabel(marks: SegmentMark[]): string {
  const top = topMark(marks);
  const confidence = meanConfidence(marks);
  return [top?.bpm ? tempoLabel(top.noteVal, top.bpm) : undefined, confidence ? confidenceLabel(confidence) : undefined].filter(Boolean).join(" · ");
}
