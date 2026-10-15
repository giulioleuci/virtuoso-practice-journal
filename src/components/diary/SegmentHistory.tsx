import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@/domain/entities/session";
import { formatDate } from "@/lib/date";
import { confidenceLabel, tempoLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useTechniques } from "@/presentation/hooks/useEntities";
import { BpmTimelineChart } from "@/components/library/BpmTimelineChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";

/**
 * Chronological history of every session that rated one section of a library item
 * (via the session mark with that `segmentId`): tempo chart plus one row per session.
 */
export function SegmentHistory({ itemId, segmentId, targetBpm }: { itemId: number; segmentId: number; targetBpm?: number }) {
  const { t, lang } = useI18n();
  const techniques = useTechniques();
  const all = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);
  const sessions = useMemo(
    () => (all ?? []).filter((s) => s.marks.some((m) => m.segmentId === segmentId)).sort((a, b) => b.date.localeCompare(a.date)),
    [all, segmentId],
  );

  if (all === undefined) return <div className="paper-skeleton h-40 w-full" />;

  return (
    <div className="space-y-8">
      {sessions.some((s) => s.marks.some((m) => m.segmentId === segmentId && m.bpm)) && (
        <section>
          <SectionHeader title={t("segment.tempo")} />
          <BpmTimelineChart sessions={sessions} segmentId={segmentId} targetBpm={targetBpm} />
        </section>
      )}

      <section>
        <SectionHeader title={t("segment.ratings")} action={<span className="text-xs tabular-nums text-muted-foreground">{t("segment.observations", { count: sessions.length })}</span>} />
        {sessions.length === 0 ? (
          <EmptyState title={t("segment.emptyTitle")} hint={t("segment.emptyHint")} />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {sessions.map((s) => {
              const m = s.marks.find((mark) => mark.segmentId === segmentId)!;
              return (
                <li key={s.id} className="py-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Link to={`/sessions/${s.id}`} className="flex-1 text-sm font-medium tabular-nums hover:underline underline-offset-4">{formatDate(s.date, lang, "weekdayShort")}</Link>
                    {m.bpm != null && <span className="text-sm font-medium tabular-nums">{tempoLabel(m.noteVal, m.bpm)}</span>}
                    {m.mood != null && <span className="text-xs tabular-nums text-muted-foreground">{t("rating.mood")} {m.mood}</span>}
                    {m.focus != null && <span className="text-xs tabular-nums text-muted-foreground">{t("rating.focus")} {m.focus}</span>}
                    {m.confidence != null && <span className="text-xs tabular-nums text-muted-foreground">{confidenceLabel(m.confidence)}</span>}
                  </div>
                  {(!!m.layers.length || !!m.techniques.length) && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {m.layers.map((l) => <span key={l}>{l}</span>)}
                      {m.techniques.map((tid) => {
                        const n = techniques?.find((x) => x.id === tid)?.name;
                        return n ? <span key={tid}>{n}</span> : null;
                      })}
                    </p>
                  )}
                  {m.confidence != null && (
                    <span className="mt-2 block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <span className={cn("block h-full rounded-full", m.confidence >= 4 ? "bg-primary" : m.confidence >= 2 ? "bg-primary/50" : "bg-muted-foreground/40")} style={{ width: `${m.confidence * 20}%` }} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
