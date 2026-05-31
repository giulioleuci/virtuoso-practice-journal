/** Next-lesson-date resolution (pure), built on the canonical recurrence expander. */
import type { Lesson, LessonRecurrence } from "@/lib/db";
import { addDays, parseDayKey } from "@/lib/date";
import { upcomingLessonDates } from "@/lib/recurrence";

export interface NextLessonOpts {
  /** Only consider this subject. */
  subjectId: number;
  /** Find the next lesson strictly after this `YYYY-MM-DD` day. Defaults to today. */
  after?: string;
  /** Already-logged lessons to consider alongside recurrence rules. */
  lessons?: Lesson[];
  /** How far ahead to look (days). */
  horizonDays?: number;
}

/**
 * The earliest lesson date strictly after `after` for the given subject,
 * considering both logged lessons and recurrence rules. Returns undefined when
 * none falls within the horizon.
 */
export function nextLessonDate(
  recurrences: LessonRecurrence[],
  opts: NextLessonOpts,
): string | undefined {
  const { subjectId, after, lessons = [], horizonDays = 365 } = opts;
  const anchor = after ?? null;
  const from = anchor ? addDays(parseDayKey(anchor), 1) : new Date();
  const limit = anchor
    ? addDays(parseDayKey(anchor), horizonDays)
    : addDays(new Date(), horizonDays);

  const candidates: string[] = [];

  for (const l of lessons) {
    if (l.subjectId === subjectId && (!anchor || l.date > anchor)) candidates.push(l.date);
  }

  for (const r of recurrences) {
    if (r.subjectId !== subjectId || r.deletedAt) continue;
    for (const d of upcomingLessonDates(r, 8, from)) {
      if (anchor && d <= anchor) continue;
      if (parseDayKey(d) > limit) break;
      candidates.push(d);
    }
  }

  candidates.sort();
  return candidates[0];
}
