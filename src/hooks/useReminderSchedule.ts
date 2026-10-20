import { useEffect } from "react";
import type { Lang } from "@/domain/entities/common";
import type { Profile } from "@/domain/entities/profile";
import { scheduleReminders } from "@/lib/platform";
import { resolveReminderText } from "@/lib/reminderPresets";

/**
 * Keeps OS-level reminder notifications in sync with the profile, app-wide, so a reminder chosen during onboarding
 * is scheduled without opening settings. No-op on the web (scheduleReminders returns early).
 */
export function useReminderSchedule(profile: Profile, lang: Lang): void {
  const reminderDaysKey = profile.reminderDays?.join(",") ?? "";
  useEffect(() => {
    if (profile.reminderEnabled === false) {
      scheduleReminders(null).catch(() => undefined);
      return;
    }
    const days = profile.reminderFreq === "weekdays"
      ? [1, 2, 3, 4, 5]
      : profile.reminderFreq === "custom"
        ? (profile.reminderDays ?? [1, 2, 3, 4, 5])
        : [0, 1, 2, 3, 4, 5, 6];
    resolveReminderText({
      lang,
      preset: profile.reminderPreset ?? "gentle",
      customTitle: profile.reminderCustomTitle,
      customBody: profile.reminderCustomBody,
      includeContext: profile.reminderIncludeContext,
    }).then(({ title, body }) =>
      scheduleReminders({ time: profile.reminderTime, days, title, body }),
    ).catch(() => undefined);
    // reminderDaysKey is a stable derivation of profile.reminderDays
  }, [profile, reminderDaysKey, lang]);
}
