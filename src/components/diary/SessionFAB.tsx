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
        "fixed bottom-[var(--floating-bottom)] right-[max(1rem,env(safe-area-inset-right))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition-[bottom,transform] hover:scale-105 active:scale-95",
        className,
      )}
    >
      <SessionIcon className="h-6 w-6" />
    </Link>
  );
}
