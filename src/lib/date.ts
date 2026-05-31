/** Single source of truth for day/week date keys and arithmetic.
 *
 * Convention: all keys are local-time `YYYY-MM-DD` strings. Dates in this app
 * are user-facing day strings, so local time is the correct reference frame
 * (a session logged at 23:30 belongs to that local day, not the UTC day).
 */

/** Local-time `YYYY-MM-DD` key for a Date. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's day key (local time). */
export function today(): string {
  return dayKey(new Date());
}

/** Parse a `YYYY-MM-DD` key to a local-time Date at midnight. */
export function parseDayKey(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** A new Date `n` days after `date` (local time; non-mutating). */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

/** Monday of the week containing `date` (local time, ISO weeks start Monday). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=Sun…6=Sat
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

/** Sunday of the week containing `date` (local time). */
export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

/**
 * Week key for `date`: the day key of that week's Monday. Two dates in the
 * same Mon–Sun week share a key; consecutive weeks differ.
 */
export function weekKey(date: Date): string {
  return dayKey(startOfWeek(date));
}

/** Convenience: week key from a `YYYY-MM-DD` string. */
export function weekKeyOf(dateStr: string): string {
  return weekKey(parseDayKey(dateStr));
}

/** Current epoch milliseconds. Centralized so time is mockable in one place. */
export function now(): number {
  return Date.now();
}
