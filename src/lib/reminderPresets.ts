/**
 * Reminder notification presets.
 *
 * The actual message strings live in the i18n dictionaries under
 * `profile.reminderPresets.<preset>.<index>` (0..POOL_SIZE-1). At schedule time
 * we pick a random body from the preset's pool so each rescheduling rotates
 * the message. Optional context (today's open task count + current streak)
 * can be appended as a localized suffix.
 */
import { db } from "@/infrastructure/dexie/db";
import type { Lang } from "@/domain/entities/common";
import { translate } from "./i18n";
import { computeStreakFromSessions } from "./domain/streak";
import { today as todayISO } from "./date";

export const REMINDER_PRESETS = ["gentle", "motivational", "playful", "minimal"] as const;
export type ReminderPresetId = typeof REMINDER_PRESETS[number];
export type ReminderPreset = ReminderPresetId | "custom";

const POOL_SIZE = 6;

export function getReminderBodies(lang: Lang, preset: ReminderPresetId): string[] {
  const out: string[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const key = `profile.reminderPresets.${preset}.${i}`;
    const raw = translate(lang, key);
    if (raw === key) break;
    out.push(raw);
  }
  return out;
}

export function pickReminderBody(lang: Lang, preset: ReminderPresetId): string {
  const pool = getReminderBodies(lang, preset);
  if (pool.length === 0) return translate(lang, "profile.reminderBody");
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface ReminderContext {
  taskCount: number;
  streak: number;
}

/** Gather "today's progress" snapshot for context-aware reminders. */
export async function gatherReminderContext(): Promise<ReminderContext> {
  const today = todayISO();
  const [tasks, sessions] = await Promise.all([
    db.tasks.where("date").equals(today).toArray(),
    db.sessions.toArray(),
  ]);
  const taskCount = tasks.filter((t) => !t.done && !t.deletedAt).length;
  const { streak } = computeStreakFromSessions(sessions);
  return { taskCount, streak };
}

export function buildContextSuffix(lang: Lang, ctx: ReminderContext): string {
  const parts: string[] = [];
  if (ctx.taskCount > 0) {
    parts.push(translate(lang, "profile.reminderContextTasks", { count: ctx.taskCount }));
  }
  if (ctx.streak > 0) {
    parts.push(translate(lang, "profile.reminderContextStreak", { streak: ctx.streak }));
  }
  return parts.join(" · ");
}

/**
 * Resolve the title + body for a reminder notification, given the user's
 * profile preferences. Performs a random pick from the preset pool.
 */
export async function resolveReminderText(opts: {
  lang: Lang;
  preset: ReminderPreset;
  customTitle?: string;
  customBody?: string;
  includeContext?: boolean;
}): Promise<{ title: string; body: string }> {
  const appName = translate(opts.lang, "app.name");
  let title = appName;
  let body: string;

  if (opts.preset === "custom") {
    title = (opts.customTitle?.trim() || appName);
    body = opts.customBody?.trim() || translate(opts.lang, "profile.reminderBody");
  } else {
    body = pickReminderBody(opts.lang, opts.preset);
  }

  if (opts.includeContext) {
    try {
      const ctx = await gatherReminderContext();
      const suffix = buildContextSuffix(opts.lang, ctx);
      if (suffix) body = `${body} · ${suffix}`;
    } catch {
      /* ignore context failure — fall back to plain body */
    }
  }

  return { title, body };
}
