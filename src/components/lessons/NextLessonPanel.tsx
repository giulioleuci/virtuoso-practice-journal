import { useMemo, useState } from "react";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import type { Subject } from "@/domain/entities/common";
import { useActiveTasks, useAllLibrary, useAssignments, useHelpRequests, useLessons, usePendingAssignmentsForSubject } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { formatDate, LANG_LOCALE, parseDayKey, today } from "@/lib/date";
import { slotForDate } from "@/lib/recurrence";
import { helpRequestsService } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalendarClock, NotebookPen, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export function NextLessonPanel({ recurrence, date, subject, onLog, onQuestions }: {
  recurrence: LessonRecurrence; date: string; subject?: Subject; onLog: () => void; onQuestions: () => void;
}) {
  const { t, lang } = useI18n();
  const tasks = useActiveTasks();
  const lessons = useLessons();
  const assignments = useAssignments();
  const pending = usePendingAssignmentsForSubject(recurrence.subjectId, recurrence.id);
  const requests = useHelpRequests();
  const items = useAllLibrary();
  const [resolvingIds, setResolvingIds] = useState<number[]>([]);
  const slot = slotForDate(recurrence, date);
  const days = Math.round((parseDayKey(date).getTime() - parseDayKey(today()).getTime()) / 86400000);
  const countdown = new Intl.RelativeTimeFormat(LANG_LOCALE[lang], { numeric: "auto" }).format(days, "day");
  const homework = useMemo(() => {
    const lessonIds = new Set((lessons ?? []).filter(lesson => lesson.recurrenceId === recurrence.id && lesson.subjectId === recurrence.subjectId).map(lesson => lesson.id));
    const taskMap = new Map((tasks ?? []).map(task => [task.id, task]));
    return (assignments ?? []).filter(assignment => {
      if (!lessonIds.has(assignment.lessonId) || assignment.ignored) return false;
      if (!assignment.transformed) return true;
      const task = assignment.taskId === undefined ? undefined : taskMap.get(assignment.taskId);
      return task !== undefined && !task.done && !task.skipped;
    });
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
  return (
    <section className="sticky top-0 z-20 bg-background border-y border-border py-3 space-y-2" aria-label={t("lessons.nextLesson")}>
      <div className="flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-primary mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-xs font-semibold text-primary">{t("lessons.nextLesson")}</h3>
            <span className="text-xs text-muted-foreground">{countdown}</span>
          </div>
          <p className="font-serif text-xl break-words">{recurrence.teacher} · {subject?.name ?? t("diary.otherSubject")}</p>
          <p className="text-xs text-muted-foreground">{formatDate(date, lang, "weekdayShort")}{slot ? ` · ${slot.startTime}–${slot.endTime}` : ""}</p>
        </div>
        <Button size="icon" variant="outline" onClick={onLog} aria-label={t("lessons.log")} title={t("lessons.log")}><NotebookPen className="h-4 w-4" /></Button>
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="preparation" className="border-0">
          <AccordionTrigger className="py-2 text-xs hover:no-underline text-left">{t("lessons.preparationCount", { homework: homework.length + (pending?.length ?? 0), questions: questions.length })}</AccordionTrigger>
          <AccordionContent className="max-h-60 overflow-y-auto space-y-4 pr-1">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">{t("homework.addShort")}</h4>
              {homework.length + (pending?.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">{t("lessons.noOpenHomework")}</p> : <ul className="space-y-2">
                {homework.map(assignment => <li key={`assigned-${assignment.id}`} className="flex gap-2 text-sm"><span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-border" /><Link className="break-words hover:underline" to={assignment.transformed ? "/" : "/lessons/assignments"}>{assignment.text}</Link></li>)}
                {(pending ?? []).map(assignment => <li key={`pending-${assignment.id}`} className="flex gap-2 text-sm"><span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-border" /><Link className="break-words hover:underline" to="/lessons/assignments">{assignment.text}</Link></li>)}
              </ul>}
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">{t("lessons.questionsShort")}</h4>
              {!questions.length ? <p className="text-xs text-muted-foreground">{t("recap.noOpenQuestions")}</p> : <ul className="space-y-1">{questions.map(question => <li key={question.id}><label className="flex min-h-11 items-start gap-3 py-2 text-sm"><Checkbox className="mt-0.5" checked={false} disabled={resolvingIds.includes(question.id)} onCheckedChange={() => resolve(question.id)} aria-label={t("lessons.resolveQuestion", { question: question.question })} /><span className="break-words">{question.question}</span></label></li>)}</ul>}
              <Button variant="ghost" size="sm" onClick={onQuestions}><HelpCircle className="h-4 w-4 mr-2" />{t("lessons.questionsShort")}</Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
