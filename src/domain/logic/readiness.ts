/** Performance readiness for a repertoire piece: BPM, segment mastery, practice frequency. */
import type { LibraryItem, Segment } from "../entities/library";
import type { Session } from "../entities/session";
import { addDays, dayKey, parseDayKey } from "@/lib/date";

export interface ReadinessBreakdown {
  /** 0-100 overall readiness. */
  overall: number;
  /** 0-100 top BPM reached against the target. */
  bpm: number;
  /** 0-100 average confidence over the piece's segments (or the whole piece). */
  mastery: number;
  /** 0-100 practice frequency over the recent window. */
  frequency: number;
  /** Number of sessions counted in the frequency window. */
  recentSessions: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/** Sessions per `FREQUENCY_WINDOW_DAYS` considered "fully prepared". */
export const FREQUENCY_TARGET = 8;
export const FREQUENCY_WINDOW_DAYS = 21;

export function calculateReadiness(
  item: Pick<LibraryItem, "targetBpm">,
  segments: Segment[],
  sessions: Session[],
  todayKey: string,
): ReadinessBreakdown {
  const windowStart = dayKey(addDays(parseDayKey(todayKey), -FREQUENCY_WINDOW_DAYS));
  const recent = sessions.filter((session) => session.date > windowStart && session.date <= todayKey);

  const topBpm = Math.max(0, ...sessions.map((session) => session.bpmReached ?? 0));
  const bpm = item.targetBpm && item.targetBpm > 0
    ? clamp((topBpm / item.targetBpm) * 100)
    : clamp(average(sessions.map((session) => ((session.confidence ?? 0) / 5) * 100)));

  const segmentScores = segments.flatMap((segment) => {
    const key = String(segment.id);
    const scored = sessions
      .filter((session) => session.segmentMetrics?.[key]?.confidence !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = scored.at(-1);
    return last ? [((last.segmentMetrics?.[key]?.confidence ?? 0) / 5) * 100] : [];
  });
  const pieceConfidence = sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((session) => session.confidence !== undefined)
    .at(-1)?.confidence;
  const mastery = segmentScores.length
    ? clamp(average(segmentScores))
    : clamp(((pieceConfidence ?? 0) / 5) * 100);

  const frequency = clamp((recent.length / FREQUENCY_TARGET) * 100);

  return {
    overall: clamp(bpm * 0.4 + mastery * 0.35 + frequency * 0.25),
    bpm,
    mastery,
    frequency,
    recentSessions: recent.length,
  };
}
