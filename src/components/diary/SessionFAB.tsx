import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { SessionIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Floating shortcut to log a free session. */
export function SessionFAB({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link
      to="/log"
      aria-label={t("diary.freeSession")}
      className={cn(
        "fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition-transform hover:scale-105 active:scale-95 min-[700px]:bottom-8",
        className,
      )}
    >
      <SessionIcon className="h-6 w-6" />
    </Link>
  );
}
