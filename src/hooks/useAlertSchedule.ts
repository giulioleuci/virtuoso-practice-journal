import { useEffect } from "react";
import type { Lang } from "@/domain/entities/common";
import type { Profile } from "@/domain/entities/profile";
import { planAlerts } from "@/lib/domain/taskAlerts";
import { translate } from "@/lib/i18n";
import { scheduleAlerts } from "@/lib/platform";
import { useAllTasks, useSessions } from "@/presentation/hooks/useEntities";

/**
 * Keeps the recurring-task and missed-practice notifications in sync with the data, app-wide.
 * There is no backend to wake the app, so the plan is rebuilt on every change and on every launch;
 * a practised day therefore cancels its pending alert. No-op on the web (scheduleAlerts returns early).
 */
export function useAlertSchedule(profile: Profile, lang: Lang): void {
  const tasks = useAllTasks();
  const sessions = useSessions();
  const days = profile.recurringAlertDays?.join(",");
  useEffect(() => {
    if (!tasks || !sessions) return;
    const title = translate(lang, "app.name");
    const alerts = planAlerts(profile, tasks, sessions, new Date()).map(({ at, kind, count }) => ({ at, title, body: translate(lang, `alerts.${kind}`, { count }) }));
    scheduleAlerts(alerts).catch(() => undefined);
    // days is a stable derivation of profile.recurringAlertDays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sessions, lang, days, profile.alertTime, profile.recurringAlertEnabled, profile.missedAlertEnabled, profile.missedAlertAfter]);
}
