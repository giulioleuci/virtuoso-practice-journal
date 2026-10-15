import type { TaskRecurrence } from "@/domain/entities/task";
import { addDays, dayKey, parseDayKey, today } from "@/lib/date";
import { schoolYearEnd } from "@/lib/recurrence";

/** Shared "when / how often" choices for quick add, bulk add and the full editor. */
export const REPEAT_PRESETS = ["none", "daily", "weekdays", "mwf", "every2"] as const;
export type RepeatPreset = (typeof REPEAT_PRESETS)[number];
export type When = "today" | "tomorrow" | "custom";

const PRESETS: Record<Exclude<RepeatPreset, "none">, Pick<TaskRecurrence, "kind" | "days" | "everyXDays">> = {
  daily: { kind: "interval", everyXDays: 1 },
  weekdays: { kind: "weekdays", days: [1, 2, 3, 4, 5] },
  mwf: { kind: "weekdays", days: [1, 3, 5] },
  every2: { kind: "interval", everyXDays: 2 },
};

export const resolveWhen = (when: When, custom: string): string =>
  when === "tomorrow" ? dayKey(addDays(parseDayKey(today()), 1)) : when === "custom" ? custom || today() : today();

/** Recurrence running until the end of the school year (same default as the full editor). */
export function presetRecurrence(preset: RepeatPreset, startDate: string): TaskRecurrence | undefined {
  if (preset === "none") return undefined;
  const end = schoolYearEnd(parseDayKey(startDate));
  // Jul/Aug start dates fall after June 30: leave the end open (capped by the generator).
  return { ...PRESETS[preset], startDate, endDate: end >= startDate ? end : undefined };
}
