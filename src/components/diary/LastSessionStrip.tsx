import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, THEORY_LAYERS, type Session, type Task } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { NOTE_GLYPH } from "@/lib/constants";
import { today } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

const QUALITY_SYMBOL: Record<string, string> = {
  hard: "♭",
  improve: "♮",
  well: "♯",
  great: "✦",
};

interface Props {
  task: Task;
  /** If provided, the strip is shown inline (e.g. in a task card). */
  compact?: boolean;
}

function daysAgoLabel(dateStr: string, t: (k: string, v?: Record<string, number>) => string): string {
  const todayKey = today();
  if (dateStr === todayKey) return t("session.lastSessionToday");
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
export function LastSessionStrip({ task, compact = false }: Props) {
  const { t } = useI18n();
  const todayKey = today();

  const lastSession = useLiveQuery(async (): Promise<Session | null> => {
    // For item-linked tasks, find sessions across all tasks for the same item
    if (task.itemId) {
      const relatedTasks = await db.tasks.where("itemId").equals(task.itemId).toArray();
      const ids = relatedTasks.map((x) => x.id!).filter(Boolean);
      if (!ids.length) return null;
      const sessions = await db.sessions
        .where("taskId")
        .anyOf(ids)
        .and((s) => s.date < todayKey)
        .sortBy("date");
      return sessions.length > 0 ? sessions[sessions.length - 1] : null;
    }
    // For free-form tasks, find previous sessions for this specific task
    if (task.id) {
      const sessions = await db.sessions
        .where("taskId")
        .equals(task.id)
        .and((s) => s.date < todayKey)
        .sortBy("date");
      return sessions.length > 0 ? sessions[sessions.length - 1] : null;
    }
    return null;
  }, [task.id, task.itemId, todayKey]);

  const isTheory = useLiveQuery(async () => {
    if (!task.subjectId) return false;
    const subject = await db.subjects.get(task.subjectId);
    return subject?.type === "theory";
  }, [task.subjectId]);

  const recentBpms = useLiveQuery(async (): Promise<number[]> => {
    if (!task.itemId || isTheory) return [];
    const relatedTasks = await db.tasks.where("itemId").equals(task.itemId).toArray();
    const ids = relatedTasks.map((x) => x.id!).filter(Boolean);
    if (!ids.length) return [];
    const sessions = await db.sessions
      .where("taskId")
      .anyOf(ids)
      .and((s) => s.date < todayKey && s.bpmReached !== undefined)
      .sortBy("date");
    return sessions.slice(-3).map((s) => s.bpmReached!);
  }, [task.itemId, isTheory, todayKey]);

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

  const theoryScores = useMemo(() => {
    if (!isTheory || !lastSession?.layerScores) return null;
    return THEORY_LAYERS.map((l) => ({
      layer: l,
      score: lastSession.layerScores![l] ?? 0,
    }));
  }, [isTheory, lastSession]);

  if (!lastSession) return null;

  if (compact) {
    return (
      <div className="text-[11px] text-muted-foreground tabular-nums inline-flex items-center gap-1 flex-wrap">
        <span className="font-medium text-foreground/60">{t("session.lastSession")}:</span>
        {lastSession.quality && (
          <span>{QUALITY_SYMBOL[lastSession.quality]}</span>
        )}
        {lastSession.bpmReached && (
          <span>{NOTE_GLYPH[lastSession.noteVal ?? "quarter"]} = {lastSession.bpmReached}</span>
        )}
        {lastSession.confidence !== undefined && (
          <span>★ {lastSession.confidence}/5</span>
        )}
        <span className="opacity-70">· {daysAgoLabel(lastSession.date, t)}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
          {t("session.lastSession")}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {daysAgoLabel(lastSession.date, t)}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {lastSession.quality && (
          <span className="font-serif text-lg leading-none" title={lastSession.quality}>
            {QUALITY_SYMBOL[lastSession.quality]}
          </span>
        )}
        {lastSession.bpmReached && (
          <div className="flex items-center gap-1">
            <span className="text-sm tabular-nums font-medium">
              {NOTE_GLYPH[lastSession.noteVal ?? "quarter"]} = {lastSession.bpmReached}
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
        {lastSession.confidence !== undefined && (
          <span className="text-sm tabular-nums text-muted-foreground">
            ★ {lastSession.confidence}/5
          </span>
        )}
      </div>

      {isTheory && theoryScores && (
        <div className="flex items-end gap-1 pt-1">
          {theoryScores.map(({ layer, score }) => (
            <div key={layer} className="flex flex-col items-center gap-0.5 flex-1">
              <div
                className={cn(
                  "w-full rounded-sm transition-all",
                  score >= 70 ? "bg-primary" : score >= 40 ? "bg-primary/50" : "bg-muted-foreground/30"
                )}
                style={{ height: `${Math.max(2, (score / 100) * 20)}px` }}
              />
              <span className="text-[8px] text-muted-foreground capitalize">{layer.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
