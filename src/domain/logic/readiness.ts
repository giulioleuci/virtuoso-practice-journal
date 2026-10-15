/** What the practice log shows about a repertoire piece: coverage, latest results and their dates. Deliberately no score. */
import type { NoteVal } from "../entities/common";
import type { LibraryItem, Segment } from "../entities/library";
import type { Session } from "../entities/session";

export interface Tempo { bpm: number; noteVal?: NoteVal; date: string }

export interface SectionEvidence {
  /** Undefined for a piece tracked as a whole. */
  segmentId?: number;
  label: string;
  lastStudied?: string;
  lastConfidence?: { value: number; date: string };
  lastTempo?: Tempo;
}

export interface PieceEvidence {
  /** Current sections of the piece; 0 means the piece is tracked as a whole. */
  total: number;
  /** Current sections with at least one confidence rating. */
  rated: number;
  sections: SectionEvidence[];
  lastStudied?: string;
  /** Labels of current sections never studied. */
  toDo: string[];
  /** Labels whose latest confidence is 1 or 2 ("" for a whole piece). */
  lowConfidence: string[];
  /** Highest tempo ever logged, one per note value: tempi counted in different note values are never compared. */
  best: Tempo[];
  targetBpm?: number;
}

/** Oldest first; same-day sessions by creation time, then id, so "latest" is stable. */
const chronological = (sessions: Session[]) =>
  [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt || a.id - b.id);

export function pieceEvidence(item: Pick<LibraryItem, "targetBpm">, segments: Pick<Segment, "id" | "label">[], sessions: Session[]): PieceEvidence {
  const ordered = chronological(sessions);
  const evidenceFor = (segmentId: number | undefined, label: string): SectionEvidence => {
    const row: SectionEvidence = { segmentId, label };
    for (const s of ordered) for (const m of s.marks) {
      if (segmentId !== undefined && m.segmentId !== segmentId) continue;
      row.lastStudied = s.date;
      if (m.confidence !== undefined) row.lastConfidence = { value: m.confidence, date: s.date };
      if (m.bpm) row.lastTempo = { bpm: m.bpm, noteVal: m.noteVal, date: s.date };
    }
    return row;
  };
  const sections = segments.length ? segments.map((s) => evidenceFor(s.id, s.label)) : [evidenceFor(undefined, "")];
  const best = new Map<NoteVal, Tempo>();
  for (const s of ordered) for (const m of s.marks) {
    const noteVal = m.noteVal ?? "quarter";
    if (m.bpm && m.bpm > (best.get(noteVal)?.bpm ?? 0)) best.set(noteVal, { bpm: m.bpm, noteVal, date: s.date });
  }
  return {
    total: segments.length,
    rated: segments.length ? sections.filter((r) => r.lastConfidence).length : 0,
    sections,
    lastStudied: ordered.at(-1)?.date,
    toDo: segments.length ? sections.filter((r) => !r.lastStudied).map((r) => r.label) : [],
    lowConfidence: sections.filter((r) => r.lastConfidence && r.lastConfidence.value <= 2).map((r) => r.label),
    best: [...best.values()],
    targetBpm: item.targetBpm,
  };
}
