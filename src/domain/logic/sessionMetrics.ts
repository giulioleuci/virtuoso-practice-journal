import type { RatingKey, SegmentMark } from "../entities/common";

/** Mark with the highest tempo, carrying its note value. */
export const topMark = (marks: SegmentMark[]): SegmentMark | undefined =>
  new Set(marks.filter(m => m.bpm !== undefined).map(m => m.noteVal ?? "quarter")).size > 1 ? undefined : marks.reduce<SegmentMark | undefined>((best, m) => (m.bpm && (!best?.bpm || m.bpm > best.bpm) ? m : best), undefined);

export const topBpm = (marks: SegmentMark[]): number | undefined => topMark(marks)?.bpm;

/** Mean of one rating over the marks that have it. */
export function meanRating(marks: SegmentMark[], key: RatingKey): number | undefined {
  const rated = marks.flatMap((m) => { const value = m[key]; return value ? [value] : []; });
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : undefined;
}

export const meanConfidence = (marks: SegmentMark[]) => meanRating(marks, "confidence");

/** Ratings a new session still needs on this mark: only confidence is required, mood and focus are optional. */
export const missingRatings = (mark: SegmentMark): RatingKey[] => (mark.confidence === undefined ? ["confidence"] : []);
