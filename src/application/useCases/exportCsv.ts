import type { Session } from "@/domain/entities/session";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";

const FORMULA = /^[=+\-@\t\r]/;

/** One CSV field: text is guarded against spreadsheet formulas, arrays become JSON, missing values stay empty. */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = Array.isArray(value) ? JSON.stringify(value) : typeof value === "string" && FORMULA.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with BOM and CRLF, so spreadsheets open accents correctly. */
export const toCsv = (columns: readonly string[], rows: Record<string, unknown>[]): string =>
  `\uFEFF${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n")}\r\n`;

export const SESSION_COLUMNS = ["session_id", "task_id", "date", "subject_id", "subject", "content_type", "item_id", "collection_id", "title", "item_title", "collection", "not_studied_segment_ids", "notes"] as const;
export const RESULT_COLUMNS = ["session_id", "scope", "segment_id", "segment_label", "bpm", "note_value", "confidence", "mood", "focus", "layers", "technique_ids", "bar_start", "bar_end", "target_bpm", "target_note_value"] as const;

/** `sessioni.csv` (one row per session) and `risultati.csv` (one row per studied section) for sessions dated in [from, to]. */
export function practiceCsv(sessions: Session[], from?: string, to?: string): { sessions: string; results: string } {
  const picked = sessions
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const label = (s: Session, segmentId?: number) => s.snapshot?.segments?.find((seg) => seg.id === String(segmentId))?.label;
  return {
    sessions: toCsv(SESSION_COLUMNS, picked.map((s) => ({
      session_id: s.id, task_id: s.taskId, date: s.date, subject_id: s.subjectId, subject: s.snapshot?.subjectName,
      content_type: s.linkType, item_id: s.itemId, collection_id: s.collectionId, title: s.snapshot?.taskTitle,
      item_title: s.snapshot?.itemTitle, collection: s.snapshot?.collectionName, not_studied_segment_ids: s.notStudied, notes: s.notes,
    }))),
    results: toCsv(RESULT_COLUMNS, picked.flatMap((s) => s.marks.map((m) => ({
      session_id: s.id, scope: m.segmentId === undefined ? "whole" : "segment", segment_id: m.segmentId, segment_label: label(s, m.segmentId),
      bpm: m.bpm, note_value: m.bpm ? m.noteVal : undefined,
      bar_start: s.snapshot?.segments?.find(seg => seg.id === String(m.segmentId))?.barStart,
      bar_end: s.snapshot?.segments?.find(seg => seg.id === String(m.segmentId))?.barEnd,
      target_bpm: m.targetBpm, target_note_value: m.targetNoteVal,
      confidence: m.confidence, mood: m.mood, focus: m.focus, layers: m.layers, technique_ids: m.techniques,
    })))),
  };
}

export class ExportCsvUseCase {
  constructor(private readonly sessions: { list(): Promise<Session[]> }, private readonly files: BackupFileGateway) {}

  // ponytail: two separate saves (two downloads / two share sheets on Android); zip them only if users ask.
  async execute(from?: string, to?: string): Promise<void> {
    const csv = practiceCsv(await this.sessions.list(), from, to);
    await this.files.save("sessioni.csv", csv.sessions);
    await this.files.save("risultati.csv", csv.results);
  }
}
