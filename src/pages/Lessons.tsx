import { useEffect, useMemo, useState } from "react";
import { subjectBorderStyle } from "@/lib/subjectColors";
import { LESSON_QUOTES, pickQuote } from "@/lib/quotes";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Lesson, type LessonRecurrence } from "@/lib/db"; // db used for useLiveQuery reads only
import { lessonsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
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
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RecurrenceSheet } from "@/components/lessons/RecurrenceSheet";
import { LessonLogSheet, type LessonLogContext } from "@/components/lessons/LessonLogSheet";
import { TeacherRecapSheet } from "@/components/lessons/TeacherRecapSheet";
import { upcomingLessonDates, dayKey, today } from "@/lib/recurrence";
import { toast } from "sonner";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";

const PAGE_SIZE = 5;

export default function Lessons() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const recurrences = useLiveQuery(() => db.recurrences.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());
  const lessons = useLiveQuery(() => db.lessons.orderBy("date").reverse().toArray());
  const assignments = useLiveQuery(() => db.assignments.toArray());
  const tasksAll = useLiveQuery(() => db.tasks.filter((task) => !task.deletedAt).toArray());
  const openHelpCount = useLiveQuery(async () => (await db.helpRequests.toArray()).filter((h) => !h.resolved).length);

  const [recapOpen, setRecapOpen] = useState(false);

  const [recOpen, setRecOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<LessonRecurrence | null>(null);
  const [delRecId, setDelRecId] = useState<number | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logContext, setLogContext] = useState<LessonLogContext | null>(null);
  const [delLessonId, setDelLessonId] = useState<number | null>(null);

  const [pageAssign, setPageAssign] = useState(0);
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

  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id!, s])), [subjects]);
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

  const pendingAssignments = (assignments ?? []).filter((a) => !a.transformed && !a.ignored);

  const upcoming = useMemo(() => {
    const today = dayKey(new Date());
    const loggedDates = new Set((lessons ?? []).map((l) => `${l.recurrenceId ?? "x"}:${l.date}`));
    const out: { rec: LessonRecurrence; date: string; isToday: boolean }[] = [];
    for (const r of recurrences ?? []) {
      const dates = upcomingLessonDates(r, 3);
      for (const d of dates) {
        if (loggedDates.has(`${r.id}:${d}`)) continue;
        out.push({ rec: r, date: d, isToday: d === today });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [recurrences, lessons]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-3xl">{t("nav.lessons")}</h2>
          <Button size="sm" variant="ghost" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> {t("lessons.addRecurrence")}
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="px-2 -ml-2" onClick={() => setRecapOpen(true)}>
          <HelpCircle className="h-4 w-4 mr-1" /> {t("lessons.recap")}
          {openHelpCount ? (
            <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
              {openHelpCount}
            </span>
          ) : null}
        </Button>
      </div>

      {/* Recurrences */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{t("lessons.teachers")}</h3>
        {!recurrences?.length ? (
          <EmptyLessons onAdd={openNew} />
        ) : (
          <ul className="space-y-2">
            {recurrences.map((r) => {
              const rSubject = subjectMap.get(r.subjectId);
              return (
                <li
                  key={r.id}
                  className="paper-card p-4 flex gap-3 border-l-4"
                  style={subjectBorderStyle(rSubject?.color, rSubject?.type, rSubject?.customColor)}
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="min-w-0">
                      <div className="font-serif text-xl break-words">{r.teacher}</div>
                      <div className="text-xs text-muted-foreground break-words">
                        {subjectName(r.subjectId)} · {r.frequency} · {t(`weekday.${r.dayOfWeek}`)} {r.startTime}–
                        {r.endTime}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 -ml-2">
                      <Button size="sm" variant="ghost" onClick={() => openLog(r)}>
                        <NotebookPen className="h-4 w-4 mr-1" /> {t("lessons.log")}
                      </Button>
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent ml-auto"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => r.id && setDelRecId(r.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pending assignments — link to dedicated page */}
      {pendingAssignments.length > 0 && (
        <Link
          to="/lessons/assignments"
          className="paper-card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform"
        >
          <Wand2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm flex-1 min-w-0 break-words">
            {t("lessons.assignments", { count: pendingAssignments.length })}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      )}

      <Accordion type="multiple" className="space-y-2">
        {/* Upcoming schedule */}
        {upcoming.length > 0 &&
          (() => {
            const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
            const page = Math.min(pageUpcoming, totalPages - 1);
            const slice = upcoming.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
            return (
              <AccordionItem value="upcoming" className="border-none">
                <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline py-2">
                  {t("lessons.upcoming", { count: upcoming.length })}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {slice.map(({ rec, date, isToday }) => {
                      const upSubject = subjectMap.get(rec.subjectId);
                      return (
                        <li
                          key={`${rec.id}-${date}`}
                          className="paper-card p-3 flex gap-3 border-l-4"
                          style={subjectBorderStyle(upSubject?.color, upSubject?.type, upSubject?.customColor)}
                        >
                          <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-1" />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm break-words">
                                {rec.teacher} · {subjectName(rec.subjectId)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isToday ? t("lessons.today") : date} · {rec.startTime}–{rec.endTime}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={isToday ? "default" : "outline"}
                              onClick={() => openLog(rec, date)}
                              className="-ml-2"
                            >
                              <NotebookPen className="h-4 w-4 mr-1" /> {t("lessons.log")}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <Pager page={page} totalPages={totalPages} onPage={setPageUpcoming} />
                </AccordionContent>
              </AccordionItem>
            );
          })()}

        {/* Recent lessons */}
        <AccordionItem value="recent" className="border-none">
          <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground hover:no-underline py-2">
            {t("lessons.recent", { count: lessons?.length ?? 0 })}
          </AccordionTrigger>
          <AccordionContent>
            {!lessons?.length ? (
              <EmptyState title={t("lessons.noLessonsLogged")} />
            ) : (
              (() => {
                const totalPages = Math.max(1, Math.ceil(lessons.length / PAGE_SIZE));
                const page = Math.min(pageRecent, totalPages - 1);
                const slice = lessons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                return (
                  <>
                    <ul className="space-y-2">
                      {slice.map((l) => {
                        const las = (assignments ?? []).filter((a) => a.lessonId === l.id);
                        const lSubject = subjectMap.get(l.subjectId);
                        return (
                          <li
                            key={l.id}
                            className="paper-card p-4 border-l-4"
                            style={subjectBorderStyle(lSubject?.color, lSubject?.type, lSubject?.customColor)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-serif text-lg">{subjectName(l.subjectId)}</div>
                                <div className="text-xs text-muted-foreground">{l.date}</div>
                                {l.notes && <p className="text-sm mt-1 line-clamp-2">{l.notes}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEditLesson(l)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => l.id && setDelLessonId(l.id)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {las.length > 0 && (
                              <ul className="mt-2 pt-2 border-t border-border/60 space-y-1">
                                {las.map((a) => {
                                  const linkedTask = a.taskId ? tasksAll?.find((tk) => tk.id === a.taskId) : undefined;
                                  return (
                                    <li key={a.id} className="text-xs flex items-center gap-2">
                                      {a.transformed ? (
                                        <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                                      ) : (
                                        <Wand2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                      )}
                                      <span className="flex-1 truncate">{a.text}</span>
                                      {a.transformed ? (
                                        <span className="text-[10px] uppercase tracking-wider text-primary truncate max-w-[40%]">
                                          → {linkedTask?.title ?? t("lessons.scheduled")}
                                        </span>
                                      ) : a.ignored ? (
                                        <button
                                          onClick={async () => {
                                            if (a.id) {
                                              await lessonsService.restoreAssignment(a.id);
                                              toast(t("toast.restored"));
                                            }
                                          }}
                                          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary italic"
                                        >
                                          {t("lessons.ignoredRestore")}
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() =>
                                              navigate("/tasks/new", {
                                                state: {
                                                  date: today(),
                                                  prefill: {
                                                    subjectId: l.subjectId,
                                                    title: a.text,
                                                    assignmentId: a.id,
                                                  },
                                                },
                                              })
                                            }
                                            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                                          >
                                            {t("lessons.makeTask")}
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (a.id) {
                                                await lessonsService.ignoreAssignment(a.id);
                                                toast(t("toast.ignored"));
                                              }
                                            }}
                                            className="text-muted-foreground hover:text-destructive"
                                            aria-label={t("common.ignore")}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
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
                    <Pager page={page} totalPages={totalPages} onPage={setPageRecent} />
                  </>
                );
              })()
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

      <TeacherRecapSheet open={recapOpen} onOpenChange={setRecapOpen} />

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

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyLessons({ onAdd }: { onAdd: () => void }) {
  const { t, lang } = useI18n();
  const quote = useMemo(() => pickQuote(LESSON_QUOTES, lang), [lang]);
  return (
    <EmptyState hint={t("lessons.empty")} quote={quote} cta={{ label: t("lessons.addRecurrence"), onClick: onAdd }} />
  );
}
