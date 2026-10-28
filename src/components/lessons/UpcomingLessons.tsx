import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import { useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { upcomingLessonDates, slotForDate } from "@/lib/recurrence";
import { dayKey, formatDate } from "@/lib/date";
import { liveLessonPath } from "@/lib/liveLesson";
import { LESSON_QUOTES, pickQuote } from "@/lib/quotes";
import { useI18n } from "@/lib/i18n";
import { usePagination } from "@/hooks/usePagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NextLessonPanel } from "./NextLessonPanel";
import { SubjectDot } from "./SubjectDot";

const PAGE_SIZE = 5;

/** What is coming: the next lesson of each teacher with its preparation, then the dates after those. */
export function UpcomingLessons({ onAddTeacher, onQuestions }: { onAddTeacher: () => void; onQuestions: (subjectId: number) => void }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const recurrences = useRecurrences();
  const subjects = useSubjects();
  const quote = useMemo(() => pickQuote(LESSON_QUOTES, lang), [lang]);
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects]);

  const { next, later } = useMemo(() => {
    const todayKey = dayKey(new Date());
    const all: { rec: LessonRecurrence; date: string; isToday: boolean }[] = [];
    for (const rec of recurrences ?? []) for (const date of upcomingLessonDates(rec, 3)) all.push({ rec, date, isToday: date === todayKey });
    all.sort((a, b) => a.date.localeCompare(b.date) || (slotForDate(a.rec, a.date)?.startTime ?? "").localeCompare(slotForDate(b.rec, b.date)?.startTime ?? ""));
    const seen = new Set<number | undefined>();
    const next = all.filter(({ rec }) => !seen.has(rec.id) && seen.add(rec.id));
    return { next, later: all.filter((u) => !next.includes(u)) };
  }, [recurrences]);
  const pager = usePagination(later, PAGE_SIZE);

  if (recurrences === undefined || subjects === undefined) return <div className="paper-skeleton h-40 w-full" />;
  if (!recurrences.length) return <EmptyState hint={t("lessons.empty")} quote={quote} cta={{ label: t("lessons.addRecurrence"), onClick: onAddTeacher }} />;
  if (!next.length) return <EmptyState hint={t("lessons.empty")} />;

  const log = (rec: LessonRecurrence, date: string) => navigate(liveLessonPath({ recurrenceId: rec.id, date }));

  return (
    <div className="space-y-8">
      {next.map(({ rec, date }) => (
        <NextLessonPanel key={`${rec.id}-${date}`} recurrence={rec} date={date} subject={subjectMap.get(rec.subjectId)}
          onLog={() => log(rec, date)} onQuestions={() => onQuestions(rec.subjectId)} />
      ))}

      {later.length > 0 && (
        <section>
          <SectionHeader title={t("lessons.later")} />
          <ul className="divide-y divide-border border-t border-border">
            {pager.pageItems.map(({ rec, date, isToday }) => {
              const slot = slotForDate(rec, date);
              return (
                <li key={`${rec.id}-${date}`} className="flex items-center gap-3 py-3.5">
                  <SubjectDot subject={subjectMap.get(rec.subjectId)} />
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <div className="break-words text-sm font-medium">{rec.teacher} · {subjectMap.get(rec.subjectId)?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{isToday ? t("common.today") : formatDate(date, lang)}{slot ? ` · ${slot.startTime}–${slot.endTime}` : ""}</div>
                  </div>
                  <Button size="sm" className="min-h-11" variant={isToday ? "default" : "outline"} onClick={() => log(rec, date)}><NotebookPen />{t("lessons.log")}</Button>
                </li>
              );
            })}
          </ul>
          <Pager page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} />
        </section>
      )}
    </div>
  );
}
