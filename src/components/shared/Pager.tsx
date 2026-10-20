import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Single pagination control. 0-based page index. Renders nothing for a single page. */
export function Pager({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;
  return (
    <div className={cn("flex items-center justify-center gap-3 pt-2", className)}>
      <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={page <= 0} onClick={() => onChange(page - 1)} aria-label={t("pager.previous")}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)} aria-label={t("pager.next")}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
