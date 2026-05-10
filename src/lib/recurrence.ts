import type { TaskRecurrence, LessonRecurrence } from "./db";

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function today(): string {
  return dayKey(new Date());
}

export function parseDayKey(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** End of the current school year (June 30). School year runs Sep 1 – Aug 31. */
export function schoolYearEnd(from = new Date()): string {
  const y = from.getMonth() >= 8 ? from.getFullYear() + 1 : from.getFullYear();
  return `${y}-06-30`;
}

const MAX_GENERATED = 200;
const HORIZON_DAYS = 365;

/** Expand a TaskRecurrence to concrete dates. */
export function expandTaskRecurrence(rec: TaskRecurrence): string[] {
  const dates: string[] = [];
  const start = parseDayKey(rec.startDate);
  const end = rec.endDate ? parseDayKey(rec.endDate) : null;
  const horizon = new Date(start);
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);
  const cap = rec.occurrences ?? MAX_GENERATED;

  if (rec.kind === "weekdays") {
    const days = rec.days ?? [];
    if (!days.length) return [];
    const cur = new Date(start);
    while (dates.length < cap && cur <= horizon) {
      if (end && cur > end) break;
      if (days.includes(cur.getDay())) dates.push(dayKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const step = Math.max(1, rec.everyXDays ?? 1);
    const cur = new Date(start);
    while (dates.length < cap && cur <= horizon) {
      if (end && cur > end) break;
      dates.push(dayKey(cur));
      cur.setDate(cur.getDate() + step);
    }
  }
  return dates;
}

/** Next N upcoming lesson dates from a LessonRecurrence (today inclusive). */
export function upcomingLessonDates(rec: LessonRecurrence, count: number, from = new Date()): string[] {
  const out: string[] = [];
  const start = parseDayKey(rec.startDate);
  const end = rec.endDate ? parseDayKey(rec.endDate) : null;
  const cur = new Date(Math.max(start.getTime(), new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()));
  // For weekly/biweekly, advance to matching weekday
  while (cur.getDay() !== rec.dayOfWeek) cur.setDate(cur.getDate() + 1);
  let safety = 0;
  while (out.length < count && safety++ < 400) {
    if (end && cur > end) break;
    if (rec.frequency === "weekly") {
      out.push(dayKey(cur));
      cur.setDate(cur.getDate() + 7);
    } else if (rec.frequency === "biweekly") {
      // align with start week parity
      const weeksSinceStart = Math.round((cur.getTime() - start.getTime()) / (7 * 86400000));
      if (weeksSinceStart % 2 === 0) out.push(dayKey(cur));
      cur.setDate(cur.getDate() + 7);
    } else {
      // monthly: same day-of-month as start, on the configured weekday — keep simple: every 4 weeks
      out.push(dayKey(cur));
      cur.setDate(cur.getDate() + 28);
    }
  }
  return out;
}
