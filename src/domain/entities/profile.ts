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
