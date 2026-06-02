/** Single source of truth for day/week date keys, arithmetic, and formatting.
 *
 * Convention: all keys are local-time `YYYY-MM-DD` strings. Dates in this app
 * are user-facing day strings, so local time is the correct reference frame
 * (a session logged at 23:30 belongs to that local day, not the UTC day).
 *
 * All user-facing date rendering should go through `formatDate` (or the
 * `useDateFormat` hook) so locale conventions stay consistent app-wide.
 */

import type { Lang } from "./db";

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

// ---------- Localized formatting ----------

/** BCP-47 locale used for date/number formatting per app language. */
export const LANG_LOCALE: Record<Lang, string> = {
  en: "en-US",
  it: "it-IT",
  es: "es-ES",
  de: "de-DE",
};

/**
 * Named date styles used across the app. Centralizing the option sets keeps
 * the convention identical wherever the same style appears.
 */
export type DateStyle =
  | "short"        // 26/05/2026 · 5/26/2026
  | "medium"       // 26 mag 2026 · May 26, 2026
  | "long"         // martedì 26 maggio 2026 · Tuesday, May 26, 2026
  | "weekdayShort" // mar 26 mag · Tue, May 26
  | "dayMonth";    // 26 mag · May 26

const STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short:        { day: "2-digit", month: "2-digit", year: "numeric" },
  medium:       { day: "numeric", month: "short", year: "numeric" },
  long:         { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  weekdayShort: { weekday: "short", day: "numeric", month: "short" },
  dayMonth:     { day: "2-digit", month: "short" },
};

/** Coerce a `YYYY-MM-DD` key or Date to a Date, treating keys as local midnight. */
function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // Local-date parse for our day-key format; falls back to Date for ISO datetimes.
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? parseDayKey(input) : new Date(input);
}

/**
 * Format a date for display in the user's language. Accepts a `YYYY-MM-DD`
 * day key or any Date / parseable string. `style` defaults to `"short"`,
 * which renders as DD/MM/YYYY in Italian, MM/DD/YYYY in English-US, etc.
 */
export function formatDate(
  input: string | Date,
  lang: Lang,
  style: DateStyle = "short",
): string {
  return toDate(input).toLocaleDateString(LANG_LOCALE[lang], STYLE_OPTIONS[style]);
}
