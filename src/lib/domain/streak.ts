/** Practice-streak computation (pure). */
import { dayKey, addDays, parseDayKey } from "@/lib/date";
import type { Session } from "@/domain/entities/session";

/** Set of day keys that have at least one session. */
export function daysFromSessions(sessions: Pick<Session, "date">[]): Set<string> {
  return new Set(sessions.map((s) => s.date));
}

export interface StreakResult {
  /** Current consecutive-day streak ending today (or yesterday if none today). */
  streak: number;
  /** Longest consecutive-day streak ever. */
  best: number;
}

/**
 * Compute current and best practice streaks from the set of days that have
 * sessions. The current streak counts back from today; if there's no session
 * today, it still counts a streak ending yesterday (grace for "today not done yet").
 */
export function computeStreak(days: Set<string>, from: Date = new Date()): StreakResult {
  let d = new Date(from);
  if (!days.has(dayKey(d))) d = addDays(d, -1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d = addDays(d, -1);
  }

  const sorted = [...days].sort();
  let best = 0;
  let cur = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      cur = 1;
    } else {
      const prevPlusOne = dayKey(addDays(parseDayKey(sorted[i - 1]), 1));
      cur = prevPlusOne === sorted[i] ? cur + 1 : 1;
    }
    if (cur > best) best = cur;
  }

  return { streak, best: Math.max(best, streak) };
}

/** Convenience: compute streak directly from sessions. */
export function computeStreakFromSessions(
  sessions: Pick<Session, "date">[],
  from?: Date,
): StreakResult {
  return computeStreak(daysFromSessions(sessions), from);
}
