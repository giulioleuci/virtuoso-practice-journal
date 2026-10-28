/** Single source of truth for day/week date keys, arithmetic, and formatting.
 *
 * Convention: all keys are local-time `YYYY-MM-DD` strings. Dates in this app
 * are user-facing day strings, so local time is the correct reference frame
 * (a session logged at 23:30 belongs to that local day, not the UTC day).
 *
 * All user-facing date rendering should go through `formatDate` (or the
 * `useDateFormat` hook) so locale conventions stay consistent app-wide.
 */

import type { Lang } from "@/domain/entities/common";

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

/** Start of the week containing `date` (local time). `weekStartsOn` is 0=Sun, 1=Mon, etc. */
export function startOfWeek(date: Date, weekStartsOn: number = 1): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=Sun…6=Sat
  const diff = (dow < weekStartsOn ? 7 : 0) + dow - weekStartsOn;
  return addDays(d, -diff);
}

/** End of the week (start + 6 days) containing `date` (local time). */
export function endOfWeek(date: Date, weekStartsOn: number = 1): Date {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

/**
 * Week key for `date`: the day key of that week's start day.
 */
export function weekKey(date: Date, weekStartsOn: number = 1): string {
  return dayKey(startOfWeek(date, weekStartsOn));
}

/** Convenience: week key from a `YYYY-MM-DD` string. */
export function weekKeyOf(dateStr: string, weekStartsOn: number = 1): string {
  return weekKey(parseDayKey(dateStr), weekStartsOn);
}

/** Default first day of week for a language (0=Sun for en, 1=Mon for others). */
export function getDefaultWeekStartsOn(lang: Lang): number {
  return lang === "en" ? 0 : 1;
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
 *
 * If `relative` is true, returns "today", "yesterday", etc. for dates within
 * 3 days of today.
 */
export function formatDate(
  input: string | Date,
  lang: Lang,
  style: DateStyle = "short",
  relative: boolean = false,
): string {
  if (relative) {
    const rel = formatRelativeDate(input, lang);
    if (rel) return rel;
  }
  return toDate(input).toLocaleDateString(LANG_LOCALE[lang], STYLE_OPTIONS[style]);
}

/**
 * Returns a relative date string (e.g. "today", "in 2 days") if the date is
 * within 3 days of today, otherwise returns null.
 */
export function formatRelativeDate(input: string | Date, lang: Lang): string | null {
  const d = toDate(input);
  const t = parseDayKey(today());
  // Normalize both to midnight for day-based difference
  const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tMid = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const diffDays = Math.round((dMid.getTime() - tMid.getTime()) / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) <= 3) {
    const rtf = new Intl.RelativeTimeFormat(LANG_LOCALE[lang], { numeric: "auto" });
    return rtf.format(diffDays, "day");
  }
  return null;
}
