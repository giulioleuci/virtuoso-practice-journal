import { useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/domain/entities/task";
import { useI18n } from "@/lib/i18n";
import { helpRequestsService } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const START_MS = 6000;
const BUMP_MS = 3000;
const TICK_MS = 100;

/** Shown after a one-tap completion. The task is only marked done: results are logged on the log page, never invented here. */
export function CompletionBar({ task, onClose, onUndo, onLog }: { task: Task; onClose: () => void; onUndo: () => void; onLog: () => void }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [writing, setWriting] = useState(false);
  const [left, setLeft] = useState(START_MS);
  const peak = useRef(START_MS);

  useEffect(() => {
    if (writing) return;
    const id = setInterval(() => setLeft((l) => l - TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [writing]);
  useEffect(() => {
    peak.current = Math.max(peak.current, left);
    if (left <= 0) onClose();
  }, [left, onClose]);

  const ask = async () => {
    const text = question.trim();
    if (!text || task.itemId === undefined) return;
    await helpRequestsService.add(task.itemId, text);
    setQuestion("");
    setLeft((l) => l + BUMP_MS);
    toast.success(t("rate.asked"));
  };

  return (
    <div
      role="region"
      aria-label={t("rate.region")}
      className={cn(
        "fixed left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] z-[60] grid max-w-[760px] gap-3 overflow-hidden rounded-[14px] border border-border bg-card p-4 shadow-raised",
        "bottom-[var(--floating-bottom)] min-[700px]:bottom-[max(calc(1.25rem+env(safe-area-inset-bottom)),var(--floating-bottom))] min-[700px]:left-[calc(195px+2rem)] min-[700px]:right-8",
        "min-[1151px]:left-[calc(208px+2rem)] min-[1600px]:left-[calc(250px+2rem)] motion-safe:animate-fade-in",
      )}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-secondary">
        <div className="h-full origin-left bg-success" style={{ transform: `scaleX(${Math.max(0, left) / peak.current})` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-success"><strong className="font-semibold">{t("rate.completed", { title: task.title })}</strong></span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline" aria-live="off">
            {writing ? t("rate.paused") : t("rate.closesIn", { s: Math.ceil(left / 1000) })}
          </span>
          <Button size="sm" variant="outline" onClick={onUndo}>{t("common.undo")}</Button>
          <Button size="icon" variant="ghost" className="h-11 w-11" aria-label={t("common.close")} onClick={onClose}><X /></Button>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("rate.completeHint")}</p>
      <button type="button" onClick={onLog} className="inline-flex min-h-11 w-fit items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        {t("rate.logResults")} <ChevronRight className="h-4 w-4" />
      </button>
      {task.itemId !== undefined && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} aria-label={t("rate.question")} placeholder={t("rate.question")}
            onFocus={() => setWriting(true)} onBlur={() => setWriting(false)} />
          <Button type="submit" size="sm" variant="outline" className="h-[42px]" disabled={!question.trim()}>{t("rate.ask")}</Button>
        </form>
      )}
    </div>
  );
}
