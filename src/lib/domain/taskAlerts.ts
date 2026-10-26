/** Local-notification plan for recurring tasks and missed practice days (pure). */
import type { Profile } from "@/domain/entities/profile";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { addDays, dayKey } from "@/lib/date";

export const DEFAULT_ALERT_TIME = "09:00";
export const DEFAULT_MISSED_AFTER = 3;
const AHEAD_DAYS = 14;
const LOOKBACK_DAYS = 60;

export interface PlannedAlert { at: Date; kind: "recurring" | "missed"; count: number }

const atTime = (day: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const at = new Date(day);
  at.setHours(h, m, 0, 0);
  return at;
};

/**
 * Recurring: one alert per upcoming day (next 14) that still has an open recurring task, on the chosen weekdays.
 * Missed: one alert at the next alert time when the last `missedAlertAfter` planned days in a row had no practice.
 * Days with no plan and no session are neutral. Callers re-plan on every data change, so a session cancels a pending alert.
 */
export function planAlerts(profile: Profile, tasks: Task[], sessions: Pick<Session, "date">[], now: Date): PlannedAlert[] {
  const time = profile.alertTime ?? DEFAULT_ALERT_TIME;
  if (!/^\d{2}:\d{2}$/.test(time)) return [];
  const live = tasks.filter((task) => !task.deletedAt);
  const alerts: PlannedAlert[] = [];

  if (profile.recurringAlertEnabled === true) {
    const days = profile.recurringAlertDays?.length ? profile.recurringAlertDays : [0, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < AHEAD_DAYS; i++) {
      const day = addDays(now, i);
      const at = atTime(day, time);
      if (at <= now || !days.includes(day.getDay())) continue;
      const key = dayKey(day);
      const count = live.filter((task) => task.date === key && !task.done && !task.skipped && (task.recurrence || task.recurrenceTaskId !== undefined)).length;
      if (count) alerts.push({ at, kind: "recurring", count });
    }
  }

  const after = profile.missedAlertAfter ?? DEFAULT_MISSED_AFTER;
  const practiced = new Set(sessions.map((session) => session.date));
  for (const task of live) if (task.done) practiced.add(task.date);
  if (profile.missedAlertEnabled === true && !practiced.has(dayKey(now))) {
    const planned = new Set(live.map((task) => task.date));
    let missed = 0;
    for (let i = 1; i <= LOOKBACK_DAYS; i++) {
      const key = dayKey(addDays(now, -i));
      if (practiced.has(key)) break;
      if (planned.has(key)) missed++;
    }
    if (missed >= after) {
      const today = atTime(now, time);
      alerts.push({ at: today > now ? today : atTime(addDays(now, 1), time), kind: "missed", count: missed });
    }
  }
  return alerts;
}
