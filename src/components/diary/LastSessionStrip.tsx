import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { SegmentMark } from "@/domain/entities/common";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { useI18n } from "@/lib/i18n";
import { confidenceLabel, sessionLabel, tempoLabel } from "@/lib/format";
import { meanConfidence, topMark } from "@/domain/logic/sessionMetrics";
import { today } from "@/lib/date";
import { cn } from "@/lib/utils";


interface Props {
  task: Task;
  /** If provided, the strip is shown inline (e.g. in a task card). */
  compact?: boolean;
  /** Offers to restart the log form from the last result's tempo, layers and techniques. */
  onRestart?: (marks: SegmentMark[]) => void;
}

function daysAgoLabel(dateStr: string, t: (k: string, v?: Record<string, number>) => string): string {
  const todayKey = today();
  if (dateStr === todayKey) return t("common.today");
  const diff = Math.round(
    (new Date(todayKey).getTime() - new Date(dateStr).getTime()) / 86400000
  );
  if (diff === 1) return t("session.lastSessionYesterday");
  return t("session.lastSessionDaysAgo", { count: diff });
}

/**
 * Compact row showing the last recorded session for the same item/task.
 * Displayed at the top of SessionLogSheet and in task cards.
 */
export function LastSessionStrip({ task, compact = false, onRestart }: Props) {
  const { t } = useI18n();
  const todayKey = today();

  const lastSession = usePresentationRead<Session | null>("sessions.lastForTask", [task.id, task.itemId, todayKey]);
  const segmentBreakdown = useMemo(() => {
    const segs = lastSession?.snapshot?.segments;
    if (!segs?.length || !lastSession) return null;
    const rows = segs
      .map(({ id, label, barStart, barEnd }) => ({ id, label: barStart === undefined ? label : `${label} · ${t("segments.bars", { start: barStart, end: barEnd! })}`, m: lastSession.marks.find((mark) => String(mark.segmentId) === id) }))
      .filter((r) => !!r.m);
    return rows.length ? rows : null;
  }, [lastSession, t]);

  if (!lastSession) return null;
  const top = topMark(lastSession.marks);
  const confidence = meanConfidence(lastSession.marks);

  if (compact) {
    return (
      <div className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1 flex-wrap">
        <span className="font-medium">{t("session.lastSession")}:</span>
        {sessionLabel(lastSession.marks) && <span>{sessionLabel(lastSession.marks)}</span>}
        <span>· {daysAgoLabel(lastSession.date, t)}</span>
      </div>
    );
  }

  return (
    <details className="space-y-1.5 border-y border-border py-3">
      <summary className="min-h-11 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
        {t("session.lastSession")}{top?.bpm ? ` · ${tempoLabel(top.noteVal, top.bpm)}` : ""} · {daysAgoLabel(lastSession.date, t)}
      </summary>
      {confidence !== undefined && <p className="text-sm tabular-nums text-muted-foreground">{confidenceLabel(confidence)}</p>}

      {onRestart && (
        <button type="button" onClick={() => onRestart(lastSession.marks)} className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
          {t("logPage.restartFrom")}
        </button>
      )}

      {segmentBreakdown && (
        <div className="pt-2 mt-1 border-t border-border/40 space-y-1">
          <ul className="space-y-1">
            {segmentBreakdown.map(({ id, label, m }) => {
              const numericId = typeof id === "string" ? Number(id) : id;
              const canDrill = !!task.itemId && Number.isFinite(numericId);
              return (
                <li key={id}>
                  <Link
                    to={canDrill ? `/library/item/${task.itemId}/segment/${numericId}` : "#"}
                    aria-disabled={!canDrill}
                    className={cn(
                      "flex min-h-9 w-full items-center gap-2 rounded-md px-1 py-1 -mx-1 text-left text-xs",
                      canDrill && "hover:bg-muted/50 transition-colors",
                    )}
                    aria-label={canDrill ? t("session.segmentHistory") : undefined}
                  >
                    <span className="truncate flex-1 text-foreground/80">{label}</span>
                    <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground shrink-0">
                      {m!.bpm != null && <span>{tempoLabel(m!.noteVal, m!.bpm)}</span>}
                      {m!.confidence != null && <span>★{m!.confidence}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </details>
  );
}
