import type { TaskRecurrence } from "@/domain/entities/task";
import type { LessonRecurrence, LessonScheduleSlot } from "@/domain/entities/lesson";
import { dayKey, parseDayKey } from "./date";

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

/** Project a single schedule slot to N upcoming dates (from `from`, inclusive). */
function upcomingForSlot(
  slot: LessonScheduleSlot,
  startDate: string,
  endDate: string | undefined,
  count: number,
  from: Date,
): string[] {
  const out: string[] = [];
  const start = parseDayKey(startDate);
  const end = endDate ? parseDayKey(endDate) : null;
  const cur = new Date(
    Math.max(start.getTime(), new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()),
  );
  while (cur.getDay() !== slot.dayOfWeek) cur.setDate(cur.getDate() + 1);
  let safety = 0;
  while (out.length < count && safety++ < 400) {
    if (end && cur > end) break;
    if (slot.frequency === "weekly") {
      out.push(dayKey(cur));
      cur.setDate(cur.getDate() + 7);
    } else if (slot.frequency === "biweekly") {
      const weeksSinceStart = Math.round((cur.getTime() - start.getTime()) / (7 * 86400000));
      if (weeksSinceStart % 2 === 0) out.push(dayKey(cur));
      cur.setDate(cur.getDate() + 7);
    } else {
      out.push(dayKey(cur));
      cur.setDate(cur.getDate() + 28);
    }
  }
  return out;
}

/** Next N upcoming lesson dates across all schedule slots (today inclusive). */
export function upcomingLessonDates(rec: LessonRecurrence, count: number, from = new Date()): string[] {
  const slots = rec.schedules ?? [];
  if (!slots.length) return [];
  const merged = new Set<string>();
  for (const slot of slots) {
    for (const d of upcomingForSlot(slot, rec.startDate, rec.endDate, count, from)) {
      merged.add(d);
    }
  }
  return [...merged].sort().slice(0, count);
}

/** Find the schedule slot active on a given date, if any. */
export function slotForDate(rec: LessonRecurrence, dateKey: string): LessonScheduleSlot | undefined {
  const date = parseDayKey(dateKey);
  if (dateKey < rec.startDate) return undefined;
  if (rec.endDate && dateKey > rec.endDate) return undefined;
  const dow = date.getDay();
  const start = parseDayKey(rec.startDate);
  for (const slot of rec.schedules ?? []) {
    if (slot.dayOfWeek !== dow) continue;
    if (slot.frequency === "weekly") return slot;
    const weeksSinceStart = Math.round((date.getTime() - start.getTime()) / (7 * 86400000));
    if (slot.frequency === "biweekly" && weeksSinceStart % 2 === 0) return slot;
    if (slot.frequency === "monthly" && weeksSinceStart % 4 === 0) return slot;
  }
  return undefined;
}
