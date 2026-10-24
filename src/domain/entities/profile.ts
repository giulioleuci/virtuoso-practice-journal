import type { Lang, ReminderFreq } from "./common";

export interface Profile {
  id: "me";
  name: string;
  lang: Lang;
  reminderTime: string;
  reminderFreq: ReminderFreq;
  reminderDays: number[];
  reminderEnabled?: boolean;
  reminderPreset?: "gentle" | "motivational" | "playful" | "minimal" | "custom";
  reminderCustomTitle?: string;
  reminderCustomBody?: string;
  reminderIncludeContext?: boolean;
  /** Task alerts: "HH:MM" for both kinds, default 09:00. */
  alertTime?: string;
  /** Alert on days with open recurring tasks (default on). */
  recurringAlertEnabled?: boolean;
  /** Weekdays 0..6 (0 = Sun) for recurring-task alerts; empty or missing = every day. */
  recurringAlertDays?: number[];
  /** Alert after `missedAlertAfter` planned practice days in a row without practice (default on, 3). */
  missedAlertEnabled?: boolean;
  missedAlertAfter?: number;
  lateRecoveryDays: number;
  carryoverDays?: number;
  graceDay: boolean;
  groupByPhase: boolean;
  hideHeroQuote?: boolean;
  weekStartsOn?: number;
  onboarded: boolean;
  introSeen?: boolean;
  createdAt: number;
}
