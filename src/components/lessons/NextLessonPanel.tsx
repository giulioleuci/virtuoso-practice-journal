import { useMemo, useState } from "react";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import type { Subject } from "@/domain/entities/common";
import { useActiveTasks, useAllLibrary, useAssignments, useHelpRequests, useLessons } from "@/presentation/hooks/useEntities";
import { isOpenAssignment } from "@/domain/logic/assignments";
import { useI18n } from "@/lib/i18n";
import { formatDate, LANG_LOCALE, parseDayKey, today } from "@/lib/date";
import { slotForDate } from "@/lib/recurrence";
import { helpRequestsService, lessonsService } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HomeworkInput } from "@/components/lessons/HomeworkInput";
import { CalendarClock, NotebookPen, HelpCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export function NextLessonPanel({ recurrence, date, subject, onLog, onQuestions }: {
  recurrence: LessonRecurrence; date: string; subject?: Subject; onLog: () => void; onQuestions: () => void;
}) {
  const { t, lang } = useI18n();
  const tasks = useActiveTasks();
  const lessons = useLessons();
  const assignments = useAssignments();
  const requests = useHelpRequests();
  const items = useAllLibrary();
  const [resolvingIds, setResolvingIds] = useState<number[]>([]);
  const slot = slotForDate(recurrence, date);
  const days = Math.round((parseDayKey(date).getTime() - parseDayKey(today()).getTime()) / 86400000);
  const countdown = new Intl.RelativeTimeFormat(LANG_LOCALE[lang], { numeric: "auto" }).format(days, "day");
  const homework = useMemo(() => {
    const lessonIds = new Set((lessons ?? []).filter(lesson => lesson.recurrenceId === recurrence.id && lesson.subjectId === recurrence.subjectId).map(lesson => lesson.id));
    const activeTasks = new Map((tasks ?? []).map(task => [task.id, task]));
    return (assignments ?? []).filter(assignment => lessonIds.has(assignment.lessonId) && isOpenAssignment(assignment, activeTasks)).sort((a, b) => a.createdAt - b.createdAt);
  }, [assignments, lessons, tasks, recurrence.id, recurrence.subjectId]);
  const questions = useMemo(() => {
    const itemSubjects = new Map((items ?? []).map(item => [item.id, item.subjectId]));
    return (requests ?? []).filter(request => !request.resolved && request.itemId !== undefined && itemSubjects.get(request.itemId) === recurrence.subjectId);
  }, [requests, items, recurrence.subjectId]);
  const resolve = async (id: number) => {
    if (resolvingIds.includes(id)) return;
    setResolvingIds(previous => [...previous, id]);
    try { await helpRequestsService.resolve(id); toast.success(t("toast.markedResolved")); }
    catch { toast.error(t("lessons.preparationError")); }
    finally { setResolvingIds(previous => previous.filter(value => value !== id)); }
  };
  const open = homework.length;
  return (
    <section className="rounded-[14px] bg-card p-6 shadow-soft" aria-label={t("lessons.nextLesson")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xs font-medium uppercase tracking-wider text-primary">{t("lessons.nextLesson")}</h2>
            <span className="text-xs text-muted-foreground">{countdown}</span>
          </div>
          <p className="mt-1 break-words font-serif text-[1.75rem] font-semibold leading-tight">{recurrence.teacher}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {subject?.name ?? t("diary.otherSubject")} · {formatDate(date, lang, "weekdayShort")}{slot ? ` · ${slot.startTime}–${slot.endTime}` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={onLog}><NotebookPen />{t("lessons.log")}</Button>
      </div>
      <HomeworkInput recurrence={recurrence} date={date} className="mt-4 flex gap-2 border-t border-border pt-4" />
      <details className="group mt-4 border-t border-border pt-3" open={open + questions.length > 0 && open + questions.length <= 6}>
        <summary className="cursor-pointer list-none text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
          {t("lessons.preparationCount", { homework: open, questions: questions.length })}
        </summary>
        <div className="mt-3 space-y-5">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">{t("homework.addShort")}</h3>
            {open === 0 ? <p className="text-xs text-muted-foreground">{t("lessons.noOpenHomework")}</p> : <ul className="space-y-1">
              {homework.map(assignment => <li key={assignment.id} className="flex items-start gap-2 text-sm">
                <span aria-hidden="true" className="mt-2 h-3 w-3 shrink-0 rounded-sm border border-border" />
                <span className="min-w-0 flex-1 break-words py-1">{assignment.text}</span>
                {assignment.taskIds.length > 0
                  ? <span className="py-1 text-xs text-primary">{t("homework.tasksLinked", { count: assignment.taskIds.length })}</span>
                  : <Link className="inline-flex min-h-8 items-center text-xs font-medium text-primary hover:underline underline-offset-4" to="/tasks/new" state={{ date: today(), prefill: { subjectId: recurrence.subjectId, title: assignment.text, assignmentId: assignment.id } }}>{t("lessons.makeTask")}</Link>}
                <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive" aria-label={`${t("common.ignore")}: ${assignment.text}`} onClick={() => void lessonsService.ignoreAssignment(assignment.id)}><X className="h-3.5 w-3.5" /></button>
              </li>)}
            </ul>}
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">{t("lessons.questionsShort")}</h3>
            {!questions.length ? <p className="text-xs text-muted-foreground">{t("recap.noOpenQuestions")}</p> : <ul className="space-y-1">{questions.map(question => <li key={question.id}><label className="flex min-h-11 items-start gap-3 py-2 text-sm"><Checkbox className="mt-0.5" checked={false} disabled={resolvingIds.includes(question.id)} onCheckedChange={() => resolve(question.id)} aria-label={t("lessons.resolveQuestion", { question: question.question })} /><span className="break-words">{question.question}</span></label></li>)}</ul>}
            <Button variant="ghost" size="sm" onClick={onQuestions}><HelpCircle />{t("lessons.questionsShort")}</Button>
          </div>
        </div>
      </details>
    </section>
  );
}
