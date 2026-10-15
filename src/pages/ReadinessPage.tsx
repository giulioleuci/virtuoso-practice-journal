import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PieceEvidence } from "@/domain/logic/readiness";
import { meanConfidence, topMark } from "@/domain/logic/sessionMetrics";
import { confidenceLabel, tempoLabel } from "@/lib/format";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { useReadiness } from "@/presentation/hooks/useReadiness";
import { useHelpRequests } from "@/presentation/hooks/useEntities";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { BpmTimelineChart } from "@/components/library/BpmTimelineChart";


/** What the log holds for one programme piece: coverage, latest ratings and tempi with dates, sessions and questions. */
export default function ReadinessPage() {
  const { t, lang } = useI18n();
  const params = useParams();
  const eventId = Number(params.id);
  const itemId = Number(params.itemId);
  const { ready, itemsById, sessionsOf, evidenceFor } = useReadiness();
  const help = useHelpRequests();

  const item = itemsById.get(itemId);
  const ordered = useMemo(() => sessionsOf(itemId).slice().sort((a, b) => b.date.localeCompare(a.date)), [sessionsOf, itemId]);

  if (!ready || help === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!item) return <EmptyState title={t("readiness.notFound")} />;

  const ev = evidenceFor(item);
  const coverage = (e: PieceEvidence) => [
    e.total ? t("evidence.rated", { rated: e.rated, total: e.total }) : t("evidence.whole"),
    e.lastStudied ? t("evidence.lastStudied", { date: formatDate(e.lastStudied, lang, "dayMonth") }) : t("evidence.never"),
  ].join(" · ");
  const itemHelp = help.filter((h) => h.itemId === itemId);

  return (
    <div className="pb-24">
      <Link to={`/library/events/${eventId}`} className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" />{t("readiness.back")}
      </Link>
      <PageHeader title={t("readiness.title", { title: item.title })} subtitle={t("readiness.subtitle")} />

      <p className="mb-8 text-sm tabular-nums text-muted-foreground">{coverage(ev)}</p>

      <div className="space-y-10">
        <section>
          <SectionHeader title={t("drilldown.timeline")} />
          <BpmTimelineChart sessions={ordered} targetBpm={item.targetBpm} />
        </section>

        <section>
          <SectionHeader title={t("drilldown.masterySources")} />
          {ev.total === 0 ? (
            <p className="border-t border-border py-4 text-sm text-muted-foreground">{t("drilldown.noSegments")}</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {ev.sections.map((s) => (
                <li key={s.segmentId}>
                  <Link to={`/library/item/${itemId}/segment/${s.segmentId}`} aria-label={t("drilldown.openSegmentSessions").replace("{label}", s.label)} className="flex min-h-12 items-center gap-3 py-3 hover:bg-secondary/30">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{s.label}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {s.lastConfidence
                          ? t("drilldown.lastRated").replace("{value}", String(s.lastConfidence.value)).replace("{date}", formatDate(s.lastConfidence.date, lang, "dayMonth"))
                          : s.lastStudied ? t("evidence.noRating") : t("evidence.never")}
                        {s.lastTempo ? ` · ${t("evidence.lastTempo", { tempo: tempoLabel(s.lastTempo.noteVal, s.lastTempo.bpm), date: formatDate(s.lastTempo.date, lang, "dayMonth") })}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader title={t("evidence.best")} />
          <ul className="divide-y divide-border border-t border-border text-sm tabular-nums">
            {ev.best.length === 0 ? <li className="py-3 text-muted-foreground">—</li> : ev.best.map((b) => (
              <li key={b.noteVal} className="py-3">{tempoLabel(b.noteVal, b.bpm)} · {formatDate(b.date, lang, "medium")}</li>
            ))}
          </ul>
          {item.targetBpm ? <p className="mt-2 text-xs text-muted-foreground">{t("evidence.target", { tempo: tempoLabel(item.noteVal, item.targetBpm) })}</p> : null}
        </section>

        <section>
          <SectionHeader title={t("drilldown.sessions").replace("{count}", String(ordered.length))} />
          {ordered.length === 0 ? (
            <p className="border-t border-border py-4 text-sm text-muted-foreground">{t("drilldown.noSessions")}</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {ordered.slice(0, 20).map((s) => (
                <li key={s.id}>
                  <Link to={`/sessions/${s.id}`} aria-label={t("drilldown.openSession").replace("{date}", formatDate(s.date, lang, "medium"))} className="flex min-h-12 items-center gap-3 py-3 hover:bg-secondary/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="tabular-nums">{formatDate(s.date, lang, "medium")}</span>
                        {topMark(s.marks)?.bpm ? <span className="text-xs tabular-nums">{tempoLabel(topMark(s.marks)!.noteVal, topMark(s.marks)!.bpm!)}</span> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {meanConfidence(s.marks) !== undefined ? confidenceLabel(meanConfidence(s.marks)!) : t("drilldown.noConfidence")}
                      </p>
                      {s.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{s.notes}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader title={t("drilldown.helpRequests").replace("{count}", String(itemHelp.length))} />
          {itemHelp.length === 0 ? (
            <p className="border-t border-border py-4 text-sm text-muted-foreground">{t("drilldown.noHelpRequests")}</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {itemHelp.map((q) => (
                <li key={q.id} className="py-3">
                  <p className="break-words text-sm">{q.question}</p>
                  {q.answer && <p className="mt-1 whitespace-pre-line break-words text-xs text-muted-foreground">{q.answer}</p>}
                </li>
              ))}
            </ul>
          )}
          <Link to={`/library/item/${itemId}?tab=questions`} className="mt-3 inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">{t("readiness.openQuestions")}</Link>
        </section>
      </div>
    </div>
  );
}
