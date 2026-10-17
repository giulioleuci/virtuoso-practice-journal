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
  const recentBpms = usePresentationRead<number[]>("sessions.recentBpms", [task.itemId, todayKey]);

  const sparklinePath = useMemo(() => {
    if (!recentBpms || recentBpms.length < 2) return null;
    const min = Math.min(...recentBpms);
    const max = Math.max(...recentBpms);
    const range = Math.max(1, max - min);
    const w = 36, h = 14;
    const step = w / (recentBpms.length - 1);
    return recentBpms
      .map((v, i) => {
        const y = h - ((v - min) / range) * (h - 2) - 1;
        return `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [recentBpms]);

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
        <span className="font-medium text-foreground/60">{t("session.lastSession")}:</span>
        {sessionLabel(lastSession.marks) && <span>{sessionLabel(lastSession.marks)}</span>}
        <span className="opacity-70">· {daysAgoLabel(lastSession.date, t)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 border-y border-border py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {t("session.lastSession")}
        </span>
        <span className="text-xs text-muted-foreground">
          {daysAgoLabel(lastSession.date, t)}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {top?.bpm && (
          <div className="flex items-center gap-1">
            <span className="text-sm tabular-nums font-medium">
              {tempoLabel(top.noteVal, top.bpm)}
            </span>
            {sparklinePath && (
              <svg viewBox="0 0 36 14" className="h-3.5 w-9 shrink-0" preserveAspectRatio="none">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
        {confidence !== undefined && (
          <span className="text-sm tabular-nums text-muted-foreground">{confidenceLabel(confidence)}</span>
        )}
      </div>

      {onRestart && (
        <button type="button" onClick={() => onRestart(lastSession.marks)} className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
          {t("logPage.restartFrom")}
        </button>
      )}

      {segmentBreakdown && (
        <div className="pt-2 mt-1 border-t border-border/40 space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground/70 font-medium">
            {t("session.segmentBreakdown")}
          </div>
          <ul className="space-y-1">
            {segmentBreakdown.map(({ id, label, m }) => {
              const avg = m!.confidence != null ? m!.confidence * 20 : null;
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
                    {avg != null && (
                      <span className="w-10 h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden shrink-0">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            avg >= 70 ? "bg-primary" : avg >= 40 ? "bg-primary/50" : "bg-muted-foreground/40"
                          )}
                          style={{ width: `${Math.max(4, avg)}%` }}
                        />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </div>
  );
}
