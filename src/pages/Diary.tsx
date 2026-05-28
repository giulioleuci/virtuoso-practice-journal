import { useMemo, useState } from "react";
import { useSessions, useStudyRoutines, useSubjects } from "@/hooks/useEntities";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task, type Session, type Profile, type LessonRecurrence, type Subject } from "@/lib/db";
import { tasksService, sessionsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { today, dayKey } from "@/lib/date";
import { upcomingLessonDates } from "@/lib/recurrence";
import { computeStreakFromSessions } from "@/lib/domain/streak";
import { NOTE_GLYPH, QUALITY_SYMBOL } from "@/lib/constants";
import { subjectBorderStyle, subjectBorderStyleLight, subjectColorCss } from "@/lib/subjectColors";
import {
  AddIcon,
  CompleteIcon,
  TasksIcon,
  PlayIcon,
  CarryOverIcon,
  CloseIcon,
  BackIcon,
  ChevronRightIcon,
  ResetIcon,
  HideIcon,
  LessonIcon,
  ArrowRightIcon,
  StreakIcon,
  SessionIcon,
} from "@/lib/icons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { SessionLogSheet } from "@/components/diary/SessionLogSheet";
import { SessionDetailSheet } from "@/components/diary/SessionDetailSheet";
import { PracticeMode } from "@/components/diary/PracticeMode";
import { LastSessionStrip } from "@/components/diary/LastSessionStrip";
import { SessionFAB } from "@/components/diary/SessionFAB";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Pager } from "@/components/shared/Pager";
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
import { pickQuote } from "@/lib/quotes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


export default function Diary() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useOutletContext<{ profile: Profile }>();
  const todayKey = today();

  const { tasks, sessionsByTask } = useLiveQuery(async () => {
    const fetchedTasks = await db.tasks
      .where("date")
      .equals(todayKey)
      .filter((t) => !t.deletedAt)
      .toArray();

    const taskIds = fetchedTasks.map((t) => t.id).filter(Boolean);
    const relevantSessions = taskIds.length > 0 ? await db.sessions.where("taskId").anyOf(taskIds).toArray() : [];

    const groupedSessions = relevantSessions.reduce<Record<number, typeof relevantSessions>>((acc, s) => {
      (acc[s.taskId] ||= [] as never).push(s as never);
      return acc;
    }, {});

    return { tasks: fetchedTasks, sessionsByTask: groupedSessions };
  }, [todayKey]) ?? { tasks: undefined, sessionsByTask: {} };

  const pendingAssignments = useLiveQuery(
    () => db.assignments.filter((a) => !a.transformed && !a.ignored).toArray(),
    [],
  );
  const pendingCount = pendingAssignments?.length ?? 0;

  const studyRoutines = useStudyRoutines();
  const subjects = useSubjects();
  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>();
    for (const s of subjects ?? []) {
      if (s.id !== undefined) map.set(s.id, s);
    }
    return map;
  }, [subjects]);

  const routineNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of studyRoutines ?? []) {
      if (r.id !== undefined && r.name) map.set(r.id, r.name);
    }
    return map;
  }, [studyRoutines]);

  // Today's lessons from recurrences
  const todayLessons = useLiveQuery(async () => {
    const recs = await db.recurrences.filter((r) => !r.deletedAt).toArray();
    return recs.filter((r) => {
      const dates = upcomingLessonDates(r, 1);
      return dates[0] === todayKey;
    });
  }, [todayKey]);

  // All-time sessions for streak calculation
  const allSessions = useSessions();
  const { streak, best: bestStreak } = useMemo(() => computeStreakFromSessions(allSessions ?? []), [allSessions]);

  const carryoverDays = profile?.carryoverDays ?? 2;
  const carryoverFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - carryoverDays);
    return dayKey(d);
  }, [carryoverDays]);

  const carryoverTasks = useLiveQuery(
    () =>
      db.tasks
        .where("date")
        .between(carryoverFrom, todayKey, true, false)
        .filter((t) => !t.done && !t.skipped)
        .toArray(),
    [carryoverFrom, todayKey],
  );

  const [logTask, setLogTask] = useState<Task | null>(null);
  const [logPrefill, setLogPrefill] = useState<
    { bpm?: number; noteVal?: import("@/lib/db").NoteVal; notes?: string } | undefined
  >();
  const [practiceTask, setPracticeTask] = useState<Task | null>(null);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [confirmUncomplete, setConfirmUncomplete] = useState<Task | null>(null);
  const [carryPage, setCarryPage] = useState(0);
  const [ignoredPage, setIgnoredPage] = useState(0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const CARRY_PAGE_SIZE = 4;
  const IGNORED_PAGE_SIZE = 5;

  const ignoredTasks = useLiveQuery(
    () =>
      db.tasks
        .where("date")
        .between(carryoverFrom, todayKey, true, false)
        .filter((t) => !!t.skipped && !t.done && !t.deletedAt)
        .toArray(),
    [carryoverFrom, todayKey],
  );

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const doneCount = tasks?.filter((x) => x.done).length ?? 0;
  const totalCount = tasks?.length ?? 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Subject filter options: only subjects present in today's tasks
  const subjectFilterOptions = useMemo(() => {
    if (!tasks || !subjects) return [];
    const idSet = new Set(tasks.map((t) => t.subjectId));
    return (subjects ?? []).filter((s) => s.id !== undefined && idSet.has(s.id));
  }, [tasks, subjects]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return tasks;
    if (selectedSubjectId === null) return tasks;
    return tasks.filter((t) => t.subjectId === selectedSubjectId);
  }, [tasks, selectedSubjectId]);

  const emptyQuote = useMemo(() => pickQuote(undefined, lang), [lang]);
  const heroQuote = useMemo(() => pickQuote(undefined, lang, todayKey), [lang, todayKey]);
  const showHeroQuote = profile?.hideHeroQuote !== true;

  return (
    <div className="space-y-6 pb-24">
      <SessionFAB />
      {/* Hero card */}
      <section className="paper-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{t("diary.today")}</p>
        <h2 className="font-serif text-3xl">{t("diary.hello", { name: profile?.name ?? "Musician" })}</h2>
        <p className="text-muted-foreground italic mt-1">{dateLabel}</p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("diary.doneSummary", { done: doneCount, total: totalCount })}
          </p>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <StreakIcon className="h-4 w-4" />
              <span className="font-semibold tabular-nums">{streak}d</span>
              {bestStreak > streak && (
                <span className="text-xs text-muted-foreground">· {t("diary.bestStreak", { count: bestStreak })}</span>
              )}
            </div>
          )}
        </div>
        {showHeroQuote && (
          <figure className="mt-4 pt-4 border-t border-border/40">
            <p className="font-serif italic text-foreground/80 leading-snug">"{heroQuote.text}"</p>
            <figcaption className="text-xs uppercase tracking-widest text-muted-foreground mt-1.5">— {heroQuote.author}</figcaption>
          </figure>
        )}
      </section>


      {/* Lessons today banner */}
      {todayLessons && todayLessons.length > 0 && (
        <div className="space-y-1">
          {todayLessons.map((rec) => (
            <LessonTodayBanner key={rec.id} rec={rec} subjects={subjects ?? []} t={t} navigate={navigate} />
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <Link
          to="/lessons/assignments"
          className="paper-card p-3 flex items-center gap-3 hover:-translate-y-0.5 transition-transform border-2 border-destructive/60 bg-destructive/5"
        >
          <LessonIcon className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm flex-1 min-w-0 break-words font-medium text-destructive tabular-nums">
            {t("diary.homework", { count: pendingCount })}
          </span>
          <ArrowRightIcon className="h-4 w-4 text-destructive shrink-0" />
        </Link>
      )}

      {/* End-of-day summary */}
      {allDone && tasks && tasks.length > 0 && (
        <EndOfDaySummary tasks={tasks} sessionsByTask={sessionsByTask} t={t} navigate={navigate} />
      )}

      <section>
        <SectionHeader
          title={t("diary.today")}
          action={
            <>
              <Link
                to="/tasks"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1"
              >
                <TasksIcon className="h-4 w-4" /> {t("common.all")}
              </Link>
              <Button size="sm" variant="ghost" onClick={() => navigate("/tasks/new", { state: { date: todayKey } })}>
                <AddIcon className="h-4 w-4 mr-1" /> {t("diary.newTask")}
              </Button>
            </>
          }
        />

        {/* Subject quick-filter */}
        {subjectFilterOptions.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
            <button
              onClick={() => setSelectedSubjectId(null)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all",
                selectedSubjectId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t("diary.allSubjects")} {tasks ? `${tasks.length}` : ""}
            </button>
            {subjectFilterOptions.map((subj) => {
              const bgColor = subjectColorCss(subj.color, subj.type, subj.customColor);
              const count = tasks?.filter((t) => t.subjectId === subj.id).length ?? 0;
              const isSelected = selectedSubjectId === subj.id;
              return (
                <button
                  key={subj.id}
                  onClick={() => setSelectedSubjectId(isSelected ? null : subj.id)}
                  className={cn(
                    "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all",
                    isSelected ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  style={isSelected ? { backgroundColor: bgColor } : undefined}
                >
                  {subj.name} {count}
                </button>
              );
            })}
          </div>
        )}

        {tasks === undefined ? (
          <div className="space-y-2">
            <div className="paper-skeleton h-20" />
            <div className="paper-skeleton h-20" />
          </div>
        ) : !tasks?.length ? (
          <EmptyState
            hint={t("diary.empty")}
            quote={emptyQuote}
            cta={{ label: t("diary.beginTask"), onClick: () => navigate("/tasks/new", { state: { date: todayKey } }) }}
          />
        ) : !filteredTasks?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("common.noResults")}</p>
        ) : (
          <ul className="space-y-2">
            {filteredTasks.map((task) => {
              const sess = (task.id && sessionsByTask[task.id]) || [];
              const last = sess[sess.length - 1];
                const subject = subjectMap.get(task.subjectId);
              return (
                <li key={task.id}>
                  <div
                    className={cn(
                      "paper-card p-4 w-full flex gap-3 transition-all hover:-translate-y-0.5 relative",
                      "border-l-4",
                      !task.done && "pb-14",
                      task.done && "opacity-70",
                    )}
                    style={subjectBorderStyle(subject?.color, subject?.type, subject?.customColor)}
                  >
                    <button
                      onClick={async () => {
                        if (task.done) {
                          setConfirmUncomplete(task);
                        } else {
                          await sessionsService.logWithCompletion(task, {
                            date: todayKey,
                            layersUsed: [],
                            techniquesUsed: [],
                          });
                          toast.success(t("toast.sessionLogged"));
                        }
                      }}
                      className="mt-0.5 shrink-0"
                      aria-label={task.done ? t("diary.markNotDone") : t("tasks.markDone")}
                    >
                      {task.done ? (
                        <span className="h-5 w-5 rounded-[4px] bg-primary flex items-center justify-center">
                          <CompleteIcon className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="h-5 w-5 rounded-[4px] border-2 border-muted-foreground block" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <button
                        onClick={() => {
                          if (task.done && last) {
                            setDetailSession(last as Session);
                          } else {
                            setLogPrefill(undefined);
                            setLogTask(task);
                          }
                        }}
                        className="w-full text-left"
                      >
                        <div className={cn("font-medium", task.done && "line-through")}>
                          {task.title}
                        </div>
                        {task.targetBpm && (
                          <div className="text-xs text-muted-foreground tabular-nums mt-1 pr-24">
                            {t("diary.targetBpm", {
                              note: task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩",
                              bpm: task.targetBpm,
                            })}
                          </div>
                        )}
                        {task.executionNotes && (
                          <div className="text-xs text-muted-foreground/80 mt-1 pr-24 italic line-clamp-2">
                            {task.executionNotes}
                          </div>
                        )}
                        {task.studyRoutineId && routineNames.get(task.studyRoutineId) && (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5 pr-24">
                            {t("diary.routine")}: {routineNames.get(task.studyRoutineId)}
                          </div>
                        )}
                        {last && (
                          <div className="text-xs text-primary tabular-nums mt-0.5 inline-flex items-center gap-1 pr-24">
                            {last.bpmReached && (
                              <>
                                {last.noteVal ? NOTE_GLYPH[last.noteVal] : "♩"} = {last.bpmReached} ·
                              </>
                            )}
                            {last.quality && QUALITY_SYMBOL[last.quality]}
                          </div>
                        )}
                      </button>

                      {/* Last session strip for undone tasks */}
                      {!task.done && task.itemId && (
                        <div className="pr-24">
                          <LastSessionStrip task={task} compact />
                        </div>
                      )}
                    </div>

                    {!task.done && (
                      <button
                        onClick={() => setPracticeTask(task)}
                        className="absolute bottom-3 right-3 shrink-0 inline-flex items-center gap-1 text-xs uppercase tracking-wider px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                        aria-label={t("diary.startPractice")}
                      >
                        <PlayIcon className="h-3.5 w-3.5" /> {t("diary.start")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!!carryoverTasks?.length && (
        <section>
          <SectionHeader
            title={t("diary.unfinished")}
            action={
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("diary.fromLastDays", { count: carryoverDays })}
              </span>
            }
          />
          {(() => {
            const total = carryoverTasks.length;
            const totalPages = Math.max(1, Math.ceil(total / CARRY_PAGE_SIZE));
            const page = Math.min(carryPage, totalPages - 1);
            const slice = carryoverTasks.slice(page * CARRY_PAGE_SIZE, page * CARRY_PAGE_SIZE + CARRY_PAGE_SIZE);
            return (
              <>
                <ul className="space-y-2">
                  {slice.map((task) => {
                    const subject = subjectMap.get(task.subjectId);
                    return (
                      <li key={task.id}>
                        <div
                          className="paper-card p-4 w-full flex flex-col gap-3 border-l-4"
                          style={subjectBorderStyleLight(subject?.color, subject?.type, subject?.customColor)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium break-words">{task.title}</div>
                            <div className="text-xs text-muted-foreground tabular-nums break-words">
                              {task.date}
                              {task.targetBpm && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {t("diary.targetBpm", {
                                    note: task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩",
                                    bpm: task.targetBpm,
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                if (!task.id) return;
                                await tasksService.carryOver(task, todayKey);
                                toast.success(t("toast.movedToToday"));
                              }}
                              className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                              aria-label={t("diary.moveToToday")}
                            >
                              <CarryOverIcon className="h-3.5 w-3.5" /> {t("common.today")}
                            </button>
                            <button
                              onClick={async () => {
                                if (!task.id) return;
                                await tasksService.skip(task.id);
                                toast(t("toast.ignored"));
                              }}
                              className="ml-auto p-2 rounded-xl text-muted-foreground hover:text-destructive"
                              aria-label={t("common.ignore")}
                            >
                              <CloseIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pager page={page} totalPages={totalPages} onChange={setCarryPage} />
              </>
            );
          })()}
        </section>
      )}

      {!!ignoredTasks?.length &&
        (() => {
          const total = ignoredTasks.length;
          const totalPages = Math.max(1, Math.ceil(total / IGNORED_PAGE_SIZE));
          const page = Math.min(ignoredPage, totalPages - 1);
          const slice = ignoredTasks.slice(page * IGNORED_PAGE_SIZE, page * IGNORED_PAGE_SIZE + IGNORED_PAGE_SIZE);
          return (
            <section>
              <Accordion type="single" collapsible className="paper-card border-0 px-3">
                <AccordionItem value="ignored" className="border-b-0">
                  <AccordionTrigger className="text-xs uppercase tracking-widest text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <HideIcon className="h-4 w-4" /> {t("diary.ignored", { count: total })}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {slice.map((task) => {
                        const subject = subjectMap.get(task.subjectId);
                        return (
                          <li key={task.id}>
                            <div
                              className="paper-card p-4 w-full flex flex-col gap-3 border-l-4"
                              style={subjectBorderStyleLight(subject?.color, subject?.type, subject?.customColor)}
                            >
                              <div className="min-w-0">
                                <div className="font-medium break-words">{task.title}</div>
                                <div className="text-xs text-muted-foreground tabular-nums break-words">
                                  {task.date}
                                  {task.targetBpm && (
                                    <>
                                      {" "}
                                      ·{" "}
                                      {t("diary.targetBpm", {
                                        note: task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩",
                                        bpm: task.targetBpm,
                                      })}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    if (!task.id) return;
                                    await tasksService.unskip(task.id);
                                    toast.success(t("toast.restored"));
                                  }}
                                  className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                                  aria-label={t("diary.unignore")}
                                >
                                  <ResetIcon className="h-3.5 w-3.5" /> {t("diary.unignore")}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Pager page={page} totalPages={totalPages} onChange={setIgnoredPage} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>
          );
        })()}

      <SessionLogSheet
        open={logTask !== null}
        onOpenChange={(o) => {
          if (!o) {
            setLogTask(null);
            setLogPrefill(undefined);
          }
        }}
        task={logTask}
        prefill={logPrefill}
      />
      {practiceTask && (
        <PracticeMode
          task={practiceTask}
          onClose={() => setPracticeTask(null)}
          onFinish={({ elapsedMs, bpm, noteVal }) => {
            const mins = Math.round(elapsedMs / 60000);
            setLogPrefill({
              bpm,
              noteVal,
              notes: mins > 0 ? t("diary.practicedMin", { count: mins }) : undefined,
            });
            setLogTask(practiceTask);
            setPracticeTask(null);
          }}
        />
      )}
      <SessionDetailSheet
        open={detailSession !== null}
        onOpenChange={(o) => {
          if (!o) setDetailSession(null);
        }}
        session={detailSession}
      />
      <AlertDialog
        open={confirmUncomplete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmUncomplete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.markNotDone")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.markNotDoneDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const task = confirmUncomplete;
                if (!task?.id) return;
                await sessionsService.deleteByTaskAndDate(task.id, task.date);
                toast.success(t("toast.taskReopened"));
                setConfirmUncomplete(null);
              }}
            >
              {t("dialog.reopen")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LessonTodayBanner({
  rec,
  subjects,
  t,
  navigate,
}: {
  rec: LessonRecurrence;
  subjects: Subject[];
  t: (k: string, v?: Record<string, string | number>) => string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const subject = subjects.find((s) => s.id === rec.subjectId);
  return (
    <div className="paper-card p-3 flex items-center gap-3 border-l-4 border-l-primary/60 bg-primary/5">
      <LessonIcon className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">
          {rec.teacher ? t("diary.lessonTodayWith", { teacher: rec.teacher }) : t("diary.lessonToday")}
        </p>
        {subject && (
          <p className="text-xs text-muted-foreground">
            {subject.name} · {rec.startTime}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 text-primary"
        onClick={() =>
          navigate("/lessons", {
            state: { openLogForRecurrenceId: rec.id, date: new Date().toISOString().slice(0, 10) },
          })
        }
      >
        {t("diary.logLesson")} <ArrowRightIcon className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}

function EndOfDaySummary({
  tasks,
  sessionsByTask,
  t,
  navigate,
}: {
  tasks: Task[];
  sessionsByTask: Record<number, Session[]>;
  t: (k: string, v?: Record<string, string | number>) => string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const rows = tasks.map((task) => {
    const sessions = (task.id && sessionsByTask[task.id]) || [];
    const last = sessions[sessions.length - 1] as Session | undefined;
    return { task, last };
  });

  return (
    <div className="paper-card p-5 border-2 border-primary/30 bg-primary/5 space-y-4">
      <div className="flex items-center gap-2">
        <SessionIcon className="h-5 w-5 text-primary" />
        <h3 className="font-serif text-xl text-primary">{t("diary.todaySummary")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{t("diary.totalPracticed", { count: tasks.length })}</p>
      <div className="space-y-1">
        {rows.map(({ task, last }) => (
          <div
            key={task.id}
            className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0"
          >
            <span className="truncate flex-1 text-muted-foreground pr-2">{task.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              {last?.quality && (
                <span className="font-serif text-base leading-none">{QUALITY_SYMBOL[last.quality]}</span>
              )}
              {last?.bpmReached && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {NOTE_GLYPH[last.noteVal ?? "quarter"]}={last.bpmReached}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/history")}>
        {t("diary.viewHistory")} <ArrowRightIcon className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}
