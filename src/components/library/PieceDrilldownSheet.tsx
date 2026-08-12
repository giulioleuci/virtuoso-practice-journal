import { useMemo, useState } from "react";
import { ChevronRight, HelpCircle, ListMusic } from "lucide-react";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import type { ReadinessBreakdown } from "@/domain/logic/readiness";
import { FREQUENCY_SPAN_DAYS, FREQUENCY_TARGET } from "@/domain/logic/readiness";
import { useHelpRequests } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { addDays, dayKey, formatDate, parseDayKey, today } from "@/lib/date";
import { NOTE_GLYPH } from "@/lib/constants";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Progress } from "@/components/ui/progress";
import { BpmTimelineChart } from "./BpmTimelineChart";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: LibraryItem | null;
  sessions: Session[];
  segments: Segment[];
  readiness: ReadinessBreakdown | null;
}

const qualityKey = (q?: string) => (q ? `session.quality${q.charAt(0).toUpperCase()}${q.slice(1)}` : undefined);

/**
 * Drill-down for one programme piece: which sessions and help requests feed the
 * mastery and readiness scores, plus a scrubable BPM timeline.
 */
export function PieceDrilldownSheet({ open, onOpenChange, item, sessions, segments, readiness }: Props) {
  const { t, lang } = useI18n();
  const helpRequests = useHelpRequests();
  const todayKey = today();
  const spanStart = dayKey(addDays(parseDayKey(todayKey), -FREQUENCY_SPAN_DAYS));

  const ordered = useMemo(
    () => sessions.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [sessions],
  );

  const itemHelp = useMemo(
    () => (helpRequests ?? []).filter((request) => item?.id !== undefined && request.itemId === item.id),
    [helpRequests, item],
  );

  const segmentRows = useMemo(() => {
    return segments.map((segment) => {
      const key = String(segment.id);
      const scored = sessions
        .filter((session) => session.segmentMetrics?.[key]?.confidence !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date));
      const last = scored.at(-1);
      return {
        segment,
        count: scored.length,
        confidence: last?.segmentMetrics?.[key]?.confidence,
        date: last?.date,
      };
    });
  }, [segments, sessions]);

  const recentCount = ordered.filter((session) => session.date > spanStart && session.date <= todayKey).length;

  return (
    <>
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item?.title ?? t("drilldown.title")}
      description={item?.composer ?? t("drilldown.title")}
      className="sm:max-w-lg"
    >
      {readiness && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("performances.readiness")}</span>
            <span className="tabular-nums font-medium text-foreground">{readiness.overall}%</span>
          </div>
          <Progress value={readiness.overall} className="h-2" />
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {t("performances.bpm")} {readiness.bpm}% · {t("performances.mastery")} {readiness.mastery}% · {t("performances.frequency")} {readiness.frequency}%
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-medium">{t("drilldown.timeline")}</h4>
        <BpmTimelineChart sessions={ordered} targetBpm={item?.targetBpm} />
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">{t("drilldown.masterySources")}</h4>
        {segmentRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("drilldown.noSegments")}</p>
        ) : (
          <ul className="space-y-1.5">
            {segmentRows.map(({ segment, count, confidence, date }) => (
              <li key={segment.id}>
                <button
                  type="button"
                  onClick={() => setSegmentDrill({ id: Number(segment.id), label: segment.label })}
                  aria-label={t("drilldown.openSegmentSessions").replace("{label}", segment.label)}
                  className="w-full flex items-start gap-2 rounded-md border border-border px-2.5 py-2 min-h-[44px] text-left hover:bg-accent/40 active:bg-accent/60"
                >
                  <ListMusic className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words">{segment.label}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {confidence !== undefined && date
                        ? `${t("drilldown.lastRated").replace("{value}", String(confidence)).replace("{date}", formatDate(date, lang, "dayMonth"))} · ${t("drilldown.ratedSessions").replace("{count}", String(count))}`
                        : t("drilldown.notRated")}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">{t("drilldown.frequencySources")}</h4>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {t("drilldown.frequencyExplain")
            .replace("{count}", String(recentCount))
            .replace("{days}", String(FREQUENCY_SPAN_DAYS))
            .replace("{target}", String(FREQUENCY_TARGET))}
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">
          {t("drilldown.sessions").replace("{count}", String(ordered.length))}
        </h4>
        {ordered.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("drilldown.noSessions")}</p>
        ) : (
          <ul className="space-y-1.5">
            {ordered.slice(0, 20).map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => setSessionDetail(session)}
                  aria-label={t("drilldown.openSession").replace("{date}", formatDate(session.date, lang, "medium"))}
                  className="w-full rounded-md border border-border px-2.5 py-2 space-y-0.5 min-h-[44px] text-left hover:bg-accent/40 active:bg-accent/60"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm tabular-nums">{formatDate(session.date, lang, "medium")}</span>
                    <span className="flex items-baseline gap-1.5 shrink-0">
                      {session.bpmReached ? (
                        <span className="text-xs tabular-nums">
                          {session.noteVal ? NOTE_GLYPH[session.noteVal] : "♩"}={session.bpmReached}
                        </span>
                      ) : null}
                      <ChevronRight className="h-4 w-4 self-center text-muted-foreground" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {session.quality ? t(qualityKey(session.quality) as string) : t("drilldown.noQuality")}
                    {session.confidence !== undefined ? ` · ${t("session.confidenceLabel")} ${session.confidence}/5` : ""}
                  </p>
                  {session.notes && <p className="text-[11px] text-muted-foreground break-words">{session.notes}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">
          {t("drilldown.helpRequests").replace("{count}", String(itemHelp.length))}
        </h4>
        {itemHelp.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("drilldown.noHelpRequests")}</p>
        ) : (
          <ul className="space-y-1.5">
            {itemHelp.map((request) => (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => setAnswersOpen(true)}
                  aria-label={t("drilldown.openAnswers")}
                  className="w-full rounded-md border border-border px-2.5 py-2 space-y-1 min-h-[44px] text-left hover:bg-accent/40 active:bg-accent/60"
                >
                  <div className="flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-sm break-words flex-1 min-w-0">{request.question}</p>
                    <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  </div>
                  {request.answer && (
                    <p className="text-[11px] text-muted-foreground break-words pl-6 whitespace-pre-line">{request.answer}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ResponsiveSheet>

      <SegmentHistorySheet
        open={segmentDrill !== null}
        onOpenChange={(next) => !next && setSegmentDrill(null)}
        itemId={item?.id}
        segmentId={segmentDrill?.id}
        segmentLabel={segmentDrill?.label}
        onOpenSession={(session) => setSessionDetail(session)}
      />

      <SessionDetailSheet
        open={sessionDetail !== null}
        onOpenChange={(next) => !next && setSessionDetail(null)}
        session={sessionDetail}
      />

      {item?.id !== undefined && (
        <TeacherAnswersSheet
          open={answersOpen}
          onOpenChange={setAnswersOpen}
          itemId={item.id}
          itemTitle={item.title}
        />
      )}
    </>
  );
}
