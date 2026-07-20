import { useMemo } from "react";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Session } from "@/domain/entities/session";
import { useTechniques } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { NOTE_GLYPH, QUALITY_SYMBOL } from "@/lib/constants";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemId?: number;
  segmentId?: number;
  segmentLabel?: string;
  onOpenSession?: (s: Session) => void;
}

/**
 * Chronological drill-down of every past session that recorded per-segment
 * metrics for the given segment (via `Session.segmentMetrics[segmentId]`).
 */
export function SegmentHistorySheet({ open, onOpenChange, itemId, segmentId, segmentLabel, onOpenSession }: Props) {
  const { t, lang } = useI18n();
  const allTechniques = useTechniques();

  const allSessions = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);
  const sessions = useMemo(() => allSessions?.filter((session) => segmentId != null && !!session.segmentMetrics?.[String(segmentId)]).sort((a, b) => b.date.localeCompare(a.date)) ?? [], [allSessions, segmentId]);

  const trend = useMemo(() => {
    if (!sessions?.length) return null;
    const bpms = sessions
      .slice()
      .reverse()
      .map((s) => s.segmentMetrics?.[String(segmentId)]?.bpmReached)
      .filter((n): n is number => n != null);
    if (bpms.length < 2) return null;
    const min = Math.min(...bpms), max = Math.max(...bpms);
    const range = Math.max(1, max - min);
    const w = 100, h = 24;
    const step = w / (bpms.length - 1);
    const d = bpms.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 2) - 1).toFixed(1)}`).join(" ");
    return { d, min, max };
  }, [sessions, segmentId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("session.segmentHistory")}</SheetTitle>
          {segmentLabel && (
            <p className="text-sm text-muted-foreground italic">{segmentLabel}</p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {trend && (
            <div className="paper-card p-3 flex items-center gap-3">
              <svg viewBox="0 0 100 24" className="h-8 w-32 shrink-0" preserveAspectRatio="none">
                <path d={trend.d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-xs text-muted-foreground tabular-nums">
                BPM {trend.min}–{trend.max}
              </div>
            </div>
          )}

          {!sessions?.length ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">
              {t("session.noSegmentHistory")}
            </p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => {
                const m = s.segmentMetrics?.[String(segmentId)];
                if (!m) return null;
                const scores = [
                  ...Object.values(m.layerScores ?? {}),
                  ...Object.values(m.techniqueScores ?? {}),
                ];
                const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                return (
                  <li key={s.id} className="paper-card p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums flex-1">{formatDate(s.date, lang)}</span>
                      {m.quality && <span className="font-serif text-lg leading-none">{QUALITY_SYMBOL[m.quality]}</span>}
                      {m.bpmReached != null && (
                        <span className="text-sm tabular-nums font-medium">
                          {NOTE_GLYPH[s.noteVal ?? "quarter"]} = {m.bpmReached}
                        </span>
                      )}
                      {m.confidence != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">★ {m.confidence}/5</span>
                      )}
                    </div>

                    {(m.layersUsed?.length || m.techniquesUsed?.length) ? (
                      <div className="flex flex-wrap gap-1">
                        {m.layersUsed?.map((l) => {
                          const score = m.layerScores?.[l];
                          return (
                            <span key={l} className="px-2 py-0.5 rounded-full text-[10px] bg-accent/60 inline-flex items-center gap-1">
                              <span>{l}</span>
                              {score != null && <span className="tabular-nums text-primary font-medium">{score}</span>}
                            </span>
                          );
                        })}
                        {m.techniquesUsed?.map((tid) => {
                          const n = (allTechniques ?? []).find((x) => x.id === tid)?.name;
                          const score = m.techniqueScores?.[tid];
                          if (!n) return null;
                          return (
                            <span key={tid} className="px-2 py-0.5 rounded-full text-[10px] bg-accent/60 inline-flex items-center gap-1">
                              <span>{n}</span>
                              {score != null && <span className="tabular-nums text-primary font-medium">{score}</span>}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2">
                      {avg != null && (
                        <span className="flex-1 h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              avg >= 70 ? "bg-primary" : avg >= 40 ? "bg-primary/50" : "bg-muted-foreground/40",
                            )}
                            style={{ width: `${Math.max(4, avg)}%` }}
                          />
                        </span>
                      )}
                      {onOpenSession && (
                        <Button size="sm" variant="ghost" onClick={() => { onOpenSession(s); onOpenChange(false); }}>
                          {t("session.viewFullSession")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
