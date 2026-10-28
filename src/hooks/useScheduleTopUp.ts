import { useEffect } from "react";
import { applicationCommands } from "@/lib/applicationCommands";

/** Writes the next stretch of recurring and routine tasks on launch and whenever the app comes back to the foreground. */
export function useScheduleTopUp(): void {
  useEffect(() => {
    const run = () => { if (document.visibilityState !== "hidden") applicationCommands.schedule.extend().catch(() => undefined); };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, []);
}
