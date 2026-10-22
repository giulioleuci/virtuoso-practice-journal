import type { NoteVal, SegmentEntry, SegmentMark } from "@/domain/entities/common";
import { NOTE_GLYPH } from "@/domain/constants/noteValues";
import { firstTempo } from "@/domain/logic/plan";
import { meanConfidence, topMark } from "@/domain/logic/sessionMetrics";

/** "♩ = 96" */
export const tempoLabel = (noteVal: NoteVal | undefined, bpm: number): string => `${noteVal ? NOTE_GLYPH[noteVal] : "?"} = ${bpm}`;

/** "★ 4" or "★ 3.5" for a mean confidence. */
export const confidenceLabel = (confidence: number): string => `★ ${Number.isInteger(confidence) ? confidence : confidence.toFixed(1)}`;

/** Target tempo of a task plan, when it has one. */
export function planTempoLabel(plan: SegmentEntry[]): string | undefined {
  const entry = firstTempo(plan);
  return entry?.bpm ? tempoLabel(entry.noteVal, entry.bpm) : undefined;
}

/** One-line result of a session: top tempo and mean confidence, e.g. "♩ = 96 · ★ 4". */
export function sessionLabel(marks: SegmentMark[]): string {
  const tempos = [...new Set(marks.filter(m => m.bpm !== undefined).map(m => m.noteVal))].map(note => topMark(marks.filter(m => (m.noteVal) === note))).flatMap(mark => mark?.bpm ? [tempoLabel(mark.noteVal, mark.bpm)] : []);
  tempos.push(...marks.filter(m => m.bpm !== undefined && m.noteVal === undefined).map(m => tempoLabel(undefined,m.bpm!)));
  const confidence = meanConfidence(marks);
  return [...tempos, confidence ? confidenceLabel(confidence) : undefined].filter(Boolean).join(" · ");
}
