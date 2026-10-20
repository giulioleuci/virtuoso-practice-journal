import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { SessionIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Labeled shortcut (`short`: compact label) to log a free session without covering the task list. */
export function SessionFAB({ className, short }: { className?: string; short?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      to="/log"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
        className,
      )}
    >
      <SessionIcon className="h-5 w-5 shrink-0" aria-hidden />{short ? t("diary.logSession") : t("rate.logResults")}
    </Link>
  );
}
