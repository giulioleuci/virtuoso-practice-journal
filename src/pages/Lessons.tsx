import { useEffect, useMemo, useState } from "react";
import { useActiveTasks, useAssignments, useLessons, useOpenHelpRequestCount, useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import { subjectColorCss } from "@/lib/subjectColors";
import { LESSON_QUOTES, pickQuote } from "@/lib/quotes";
import type { Lesson, LessonRecurrence } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { needsTask } from "@/domain/logic/assignments";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  NotebookPen,
  Wand2,
  CheckCircle2,
  HelpCircle,
  CalendarClock,
  ChevronRight,
  X,
} from "lucide-react";
import { RecurrenceSheet } from "@/components/lessons/RecurrenceSheet";
import { LessonLogSheet, type LessonLogContext } from "@/components/lessons/LessonLogSheet";
import { LessonExtraActions } from "@/components/lessons/LessonExtraActions";
import { TeacherRecapSheet } from "@/components/lessons/TeacherRecapSheet";
import { NextLessonPanel } from "@/components/lessons/NextLessonPanel";
import { upcomingLessonDates, slotForDate } from "@/lib/recurrence";
import { dayKey, today } from "@/lib/date";
import { toast } from "sonner";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";

const PAGE_SIZE = 5;

export default function Lessons() {
  const { t, lang } = useI18n();
  const lessonQuote = useMemo(() => pickQuote(LESSON_QUOTES, lang), [lang]);
  const navigate = useNavigate();
  const location = useLocation();
  const recurrences = useRecurrences();
  const subjects = useSubjects();
  const lessons = useLessons();
  const assignments = useAssignments();
  const tasksAll = useActiveTasks();
  const openHelpCount = useOpenHelpRequestCount();

  const [recapOpen, setRecapOpen] = useState(false);
  const [recapSubjectId, setRecapSubjectId] = useState<number | undefined>();

  const [recOpen, setRecOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<LessonRecurrence | null>(null);
  const [delRecId, setDelRecId] = useState<number | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logContext, setLogContext] = useState<LessonLogContext | null>(null);
  const [delLessonId, setDelLessonId] = useState<number | null>(null);

  const [pageUpcoming, setPageUpcoming] = useState(0);
  const [pageRecent, setPageRecent] = useState(0);

  const openNew = () => {
    setEditingRec(null);
    setRecOpen(true);
  };
  const openEdit = (r: LessonRecurrence) => {
    setEditingRec(r);
    setRecOpen(true);
  };

  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects]);
  const subjectName = (id: number) => subjectMap.get(id)?.name ?? "—";

  const openLog = (r: LessonRecurrence, date?: string) => {
    setLogContext({ recurrence: r, prefilledDate: date });
    setLogOpen(true);
  };
  const openEditLesson = (l: Lesson) => {
    setLogContext({ lesson: l, recurrence: recurrences?.find((r) => r.id === l.recurrenceId) ?? null });
    setLogOpen(true);
  };

  // Open lesson log when navigated here from the Diary today-lesson banner.
  useEffect(() => {
    const s = location.state as { openLogForRecurrenceId?: number; date?: string } | null;
    if (!s?.openLogForRecurrenceId || !recurrences) return;
    const rec = recurrences.find((r) => r.id === s.openLogForRecurrenceId);
    // Clear state regardless so a missing/deleted recurrence doesn't cause an infinite retry.
    navigate(location.pathname, { replace: true, state: null });
    if (rec) openLog(rec, s.date);
  }, [location.state, recurrences]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteRec = async () => {
    if (delRecId == null) return;
    await lessonsService.deleteRecurrence(delRecId);
    toast.success(t("toast.removed"));
    setDelRecId(null);
  };
  const deleteLesson = async () => {
    if (delLessonId == null) return;
    await lessonsService.deleteLesson(delLessonId);
    toast.success(t("toast.lessonDeleted"));
    setDelLessonId(null);
  };

  const pendingAssignments = (assignments ?? []).filter(needsTask);

  const upcoming = useMemo(() => {
    const today = dayKey(new Date());
    const out: { rec: LessonRecurrence; date: string; isToday: boolean; slot?: ReturnType<typeof slotForDate> }[] = [];
    for (const r of recurrences ?? []) {
      const dates = upcomingLessonDates(r, 3);
      for (const d of dates) {
        out.push({ rec: r, date: d, isToday: d === today, slot: slotForDate(r, d) });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || (a.slot?.startTime ?? "").localeCompare(b.slot?.startTime ?? ""));
  }, [recurrences]);

  // One live panel per teacher, nearest lesson first.
  const nextPerTeacher = useMemo(() => upcoming.filter((u, i) => upcoming.findIndex((o) => o.rec.id === u.rec.id) === i), [upcoming]);


  const dot = (subjectId: number) => {
    const sub = subjectMap.get(subjectId);
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(sub?.color, sub?.type, sub?.customColor) }} title={sub?.name} role="img" aria-label={sub?.name} />;
  };
  const linkBtn = "inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4";
  const iconBtn = "inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40";

  const upcomingTotal = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
  const upcomingPage = Math.min(pageUpcoming, upcomingTotal - 1);
  const recentTotal = Math.max(1, Math.ceil((lessons?.length ?? 0) / PAGE_SIZE));
  const recentPage = Math.min(pageRecent, recentTotal - 1);

  return (
    <div className="pb-24">
      <PageHeader
        title={t("nav.lessons")}

        actions={<Button onClick={openNew}><Plus /> {t("lessons.addRecurrence")}</Button>}
      />

      <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
        <div className="min-w-0 space-y-8">
          {nextPerTeacher.map(({ rec, date }) => <NextLessonPanel key={`${rec.id}-${date}`}
            recurrence={rec} date={date} subject={subjectMap.get(rec.subjectId)}
            onLog={() => openLog(rec, date)}
            onQuestions={() => { setRecapSubjectId(rec.subjectId); setRecapOpen(true); }} />)}

          {pendingAssignments.length > 0 && (
            <Link to="/lessons/assignments" className="flex items-center gap-3 border-y border-primary/30 py-3 text-sm font-medium text-primary hover:bg-primary/5">
              <Wand2 className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{t("lessons.assignments", { count: pendingAssignments.length })}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          )}

          {upcoming.length > 0 && (
            <section>
              <SectionHeader title={t("lessons.upcoming", { count: upcoming.length })} />
              <ul className="divide-y divide-border border-t border-border">
                {upcoming.slice(upcomingPage * PAGE_SIZE, (upcomingPage + 1) * PAGE_SIZE).map(({ rec, date, isToday, slot }) => (
                  <li key={`${rec.id}-${date}`} className="flex items-center gap-3 py-3.5">
                    {dot(rec.subjectId)}
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium">{rec.teacher} · {subjectName(rec.subjectId)}</div>
                      <div className="text-xs text-muted-foreground">{isToday ? t("common.today") : formatDate(date, lang)}{slot ? ` · ${slot.startTime}–${slot.endTime}` : ""}</div>
                    </div>
                    <Button size="sm" variant={isToday ? "default" : "outline"} onClick={() => openLog(rec, date)}><NotebookPen />{t("lessons.log")}</Button>
                  </li>
                ))}
              </ul>
              <Pager page={upcomingPage} totalPages={upcomingTotal} onChange={setPageUpcoming} />
            </section>
          )}

          <section>
            <SectionHeader title={t("lessons.recent", { count: lessons?.length ?? 0 })} />
            {!lessons?.length ? (
              <EmptyState title={t("lessons.noLessonsLogged")} />
            ) : (
              <>
                <ul className="divide-y divide-border border-t border-border">
                  {lessons.slice(recentPage * PAGE_SIZE, (recentPage + 1) * PAGE_SIZE).map((l) => {
                    const las = (assignments ?? []).filter((a) => a.lessonId === l.id);
                    return (
                      <li key={l.id} className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="flex items-center gap-2 font-serif text-xl font-semibold">{dot(l.subjectId)}{subjectName(l.subjectId)}</h3>
                            <div className="text-xs text-muted-foreground">{formatDate(l.date, lang)}</div>
                            {l.notes && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{l.notes}</p>}
                          </div>
                          <button onClick={() => openEditLesson(l)} className={iconBtn} aria-label={`${t("common.edit")} ${formatDate(l.date, lang)}`}><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => l.id && setDelLessonId(l.id)} className={`${iconBtn} hover:text-destructive`} aria-label={`${t("common.delete")} ${formatDate(l.date, lang)}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                        {las.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-border pt-2">
                            {las.map((a) => {
                              const linked = a.taskIds.flatMap((id) => tasksAll?.find((tk) => tk.id === id) ?? []);
                              return (
                                <li key={a.id} className="flex items-center gap-2 text-xs">
                                  {a.taskIds.length ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Wand2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                  <span className="flex-1 truncate">{a.text}</span>
                                  {a.taskIds.length ? (
                                    <span className="max-w-[40%] truncate text-primary">→ {linked.length === 1 ? linked[0].title : t("homework.tasksLinked", { count: a.taskIds.length })}</span>
                                  ) : a.ignored ? (
                                    <button onClick={async () => { await lessonsService.restoreAssignment(a.id); toast(t("toast.restored")); }} className="italic text-muted-foreground hover:text-primary">{t("lessons.ignoredRestore")}</button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { subjectId: l.subjectId, title: a.text, assignmentId: a.id } } })}
                                        className="font-medium text-primary hover:underline underline-offset-4"
                                      >
                                        {t("lessons.makeTask")}
                                      </button>
                                      <button onClick={async () => { await lessonsService.ignoreAssignment(a.id); toast(t("toast.ignored")); }} className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive" aria-label={t("common.ignore")}><X className="h-3.5 w-3.5" /></button>
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Pager page={recentPage} totalPages={recentTotal} onChange={setPageRecent} />
              </>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("lessons.teachers")}</h2>
            {!recurrences?.length ? (
              <EmptyState hint={t("lessons.empty")} quote={lessonQuote} cta={{ label: t("lessons.addRecurrence"), onClick: openNew }} />
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {recurrences.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-serif text-xl font-semibold leading-tight">{r.teacher}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">{dot(r.subjectId)}{subjectName(r.subjectId)}</div>
                      </div>
                      <button onClick={() => openEdit(r)} aria-label={`${t("common.edit")} ${r.teacher ?? ""}`} className={iconBtn}><Pencil className="h-[18px] w-[18px]" /></button>
                      <button onClick={() => r.id && setDelRecId(r.id)} aria-label={`${t("common.delete")} ${r.teacher ?? ""}`} className={`${iconBtn} hover:text-destructive`}><Trash2 className="h-[18px] w-[18px]" /></button>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {(r.schedules ?? []).map((slot, i) => (
                        <li key={i} className="flex items-center gap-1.5 tabular-nums">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {t(`weekday.${slot.dayOfWeek}`)} · {slot.startTime}–{slot.endTime} · {t(`teacher.freq.${slot.frequency}`)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5">
                      <button onClick={() => openLog(r)} className={linkBtn}><NotebookPen className="h-4 w-4" />{t("lessons.log")}</button>
                    </div>
                    <LessonExtraActions subjectId={r.subjectId} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Button variant="outline" onClick={() => { setRecapSubjectId(undefined); setRecapOpen(true); }}>
            <HelpCircle /> {t("lessons.recap")}
            {openHelpCount ? <span className="rounded-full bg-primary px-1.5 py-0.5 font-numeric text-xs text-primary-foreground">{openHelpCount}</span> : null}
          </Button>
        </aside>
      </div>

      <RecurrenceSheet
        open={recOpen}
        onOpenChange={(o) => {
          setRecOpen(o);
          if (!o) setEditingRec(null);
        }}
        recurrence={editingRec}
      />

      <LessonLogSheet
        open={logOpen}
        onOpenChange={(o) => {
          setLogOpen(o);
          if (!o) setLogContext(null);
        }}
        context={logContext || undefined}
      />

      <TeacherRecapSheet open={recapOpen} onOpenChange={setRecapOpen} subjectId={recapSubjectId} />

      <AlertDialog open={delRecId !== null} onOpenChange={(o) => !o && setDelRecId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.removeTeacher")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.removeTeacherDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRec}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delLessonId !== null} onOpenChange={(o) => !o && setDelLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteLesson")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteLessonDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteLesson}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
