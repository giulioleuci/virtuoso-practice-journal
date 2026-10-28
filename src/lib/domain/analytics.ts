/** Pure analytics helpers over sessions. */
import { weekKeyOf } from "@/lib/date";
import type { Session } from "@/domain/entities/session";

export interface WeeklyCount {
  /** Monday-anchored week key (YYYY-MM-DD). */
  weekKey: string;
  count: number;
}

/**
 * Count sessions per week, sorted chronologically. Optionally keep only the
 * most recent `limit` weeks. Respects `weekStartsOn` (0=Sun, 1=Mon, etc).
 */
export function weeklySessionCounts(
  sessions: Pick<Session, "date">[],
  limit?: number,
  weekStartsOn: number = 1,
): WeeklyCount[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const wk = weekKeyOf(s.date, weekStartsOn);
    counts.set(wk, (counts.get(wk) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, count]) => ({ weekKey, count }));
  return limit != null ? sorted.slice(-limit) : sorted;
}
