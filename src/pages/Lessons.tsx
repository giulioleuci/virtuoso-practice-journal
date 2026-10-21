import { lazy, Suspense, useMemo, useState } from "react";
import { useActiveTasks, useAssignments, useLessons, useOpenHelpRequestCount, useRecurrences, useSubjects } from "@/presentation/hooks/useEntities";
import { subjectColorCss } from "@/lib/subjectColors";
import { LESSON_QUOTES, pickQuote } from "@/lib/quotes";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { lessonsService } from "@/lib/services";
import { assignmentsToPlan } from "@/presentation/utils/assignments";
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
import { LessonExtraActions } from "@/components/lessons/LessonExtraActions";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { NextLessonPanel } from "@/components/lessons/NextLessonPanel";
import { upcomingLessonDates, slotForDate } from "@/lib/recurrence";
import { dayKey, today } from "@/lib/date";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { liveLessonPath } from "@/lib/liveLesson";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";

const PAGE_SIZE = 5;
const TeacherRecapSheet = lazy(() => import("@/components/lessons/TeacherRecapSheet").then(module => ({ default: module.TeacherRecapSheet })));

export default function Lessons() {
  const { t, lang } = useI18n();
  const lessonQuote = useMemo(() => pickQuote(LESSON_QUOTES, lang), [lang]);
  const navigate = useNavigate();
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

  const [delLessonId, setDelLessonId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openLog = (r: LessonRecurrence, date = today()) => navigate(liveLessonPath({ recurrenceId: r.id, date }));

  const deleteRec = async () => {
    if (delRecId == null || deleting) return;
    setDeleting(true);
    try { await lessonsService.deleteRecurrence(delRecId); toast.success(t("toast.removed")); setDelRecId(null); }
    catch { toast.error(t("errors.couldNotSave")); }
    finally { setDeleting(false); }
  };
  const deleteLesson = async () => {
    if (delLessonId == null || deleting) return;
    setDeleting(true);
    try { await lessonsService.deleteLesson(delLessonId); toast.success(t("toast.lessonDeleted")); setDelLessonId(null); }
    catch { toast.error(t("errors.couldNotSave")); }
    finally { setDeleting(false); }
  };

  const pendingAssignments = assignmentsToPlan(assignments, tasksAll);

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
  const iconBtn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40";

  const upcomingTotal = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
  const upcomingPage = Math.min(pageUpcoming, upcomingTotal - 1);
  const recentTotal = Math.max(1, Math.ceil((lessons?.length ?? 0) / PAGE_SIZE));
  const recentPage = Math.min(pageRecent, recentTotal - 1);

  if (recurrences === undefined || subjects === undefined || lessons === undefined || assignments === undefined || tasksAll === undefined) return <div className="paper-skeleton h-40 w-full" />;

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
                    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <div className="break-words text-sm font-medium">{rec.teacher} · {subjectName(rec.subjectId)}</div>
                      <div className="text-xs text-muted-foreground">{isToday ? t("common.today") : formatDate(date, lang)}{slot ? ` · ${slot.startTime}–${slot.endTime}` : ""}</div>
                    </div>
                    <Button size="sm" className="min-h-11" variant={isToday ? "default" : "outline"} onClick={() => openLog(rec, date)}><NotebookPen />{t("lessons.log")}</Button>
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
                          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                            <h3 className="flex items-center gap-2 font-serif text-xl font-semibold">{dot(l.subjectId)}{subjectName(l.subjectId)}</h3>
                            <div className="text-xs text-muted-foreground">{formatDate(l.date, lang)}</div>
                            {Array.isArray(l.notes) && l.notes.length > 0 && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{l.notes.map((n) => n.text).join(" · ")}</p>}
                          </div>
                          <button onClick={() => navigate(liveLessonPath({ lessonId: l.id }))} className={iconBtn} aria-label={`${t("common.edit")} ${formatDate(l.date, lang)}`}><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => l.id && setDelLessonId(l.id)} className={`${iconBtn} hover:text-destructive`} aria-label={`${t("common.delete")} ${formatDate(l.date, lang)}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                        {las.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-border pt-2">
                            {las.map((a) => {
                              const linked = a.taskIds.flatMap((id) => tasksAll?.find((tk) => tk.id === id) ?? []);
                              return (
                                <li key={a.id} className="flex items-center gap-2 text-xs">
                                  {linked.length ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Wand2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                  <span className="flex-1 truncate" title={a.text}>{a.text}</span>
                                  {linked.length ? (
                                    <span className="max-w-[40%] truncate text-primary">→ {linked.length === 1 ? linked[0].title : t("homework.tasksLinked", { count: linked.length })}</span>
                                  ) : a.ignored ? (
                                    <button onClick={async () => { try { await lessonsService.restoreAssignment(a.id); toast(t("toast.restored")); } catch { toast.error(t("errors.couldNotSave")); } }} className="min-h-11 italic text-muted-foreground hover:text-primary">{t("lessons.ignoredRestore")}</button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => navigate("/tasks/new", { state: { date: today(), prefill: { subjectId: l.subjectId, title: a.text, assignmentId: a.id } } })}
                                        className="min-h-11 font-medium text-primary hover:underline underline-offset-4"
                                      >
                                        {t("lessons.makeTask")}
                                      </button>
                                      <button onClick={async () => { try { await lessonsService.ignoreAssignment(a.id); toast(t("toast.ignored")); } catch { toast.error(t("errors.couldNotSave")); } }} className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive" aria-label={t("common.ignore")}><X className="h-3.5 w-3.5" /></button>
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
                      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
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

      {recapOpen && <Suspense fallback={<ResponsiveSheet open onOpenChange={setRecapOpen} title={t("recap.title")} description={t("recap.subtitle")}><p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p></ResponsiveSheet>}>
        <TeacherRecapSheet open onOpenChange={setRecapOpen} subjectId={recapSubjectId} />
      </Suspense>}

      <AlertDialog open={delRecId !== null} onOpenChange={(o) => !o && !deleting && setDelRecId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.removeTeacher")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.removeTeacherDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={event => { event.preventDefault(); void deleteRec(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delLessonId !== null} onOpenChange={(o) => !o && !deleting && setDelLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteLesson")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteLessonDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={event => { event.preventDefault(); void deleteLesson(); }}
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
