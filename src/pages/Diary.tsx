import { useMemo, useState } from "react";
import { useSessions, useStudyRoutines, useSubjects } from "@/presentation/hooks/useEntities";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Task } from "@/domain/entities/task";
import type { Session } from "@/domain/entities/session";
import type { Profile } from "@/domain/entities/profile";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import type { Subject } from "@/domain/entities/common";
import { remainingSegmentIds } from "@/domain/logic/plan";
import { tasksService, sessionsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { today, dayKey, formatDate, now, addDays, parseDayKey, getDefaultWeekStartsOn } from "@/lib/date";
import { slotForDate } from "@/lib/recurrence";
import { computeStreakFromSessions } from "@/lib/domain/streak";
import { planTempoLabel, sessionLabel } from "@/lib/format";
import { subjectColorCss } from "@/lib/subjectColors";
import {
  AddIcon,
  CompleteIcon,
  TasksIcon,
  PlayIcon,
  CarryOverIcon,
  CloseIcon,
  ResetIcon,
  HideIcon,
  LessonIcon,
  ArrowRightIcon,
  SessionIcon,
} from "@/lib/icons";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { PracticeMode } from "@/components/diary/PracticeMode";
import { LastSessionStrip } from "@/components/diary/LastSessionStrip";
import { CarryoverBatchActions } from "@/components/diary/CarryoverBatchActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { TeacherAnswersSheet } from "@/components/library/TeacherAnswersSheet";
import { Archive, CalendarPlus, Check, CheckSquare, MessageSquareQuote, Trash2 } from "lucide-react";
import { SessionFAB } from "@/components/diary/SessionFAB";
import { CompletionBar } from "@/components/diary/CompletionBar";
import { QuickAdd } from "@/components/diary/QuickAdd";
import { WeekStrip } from "@/components/diary/WeekStrip";
import { LessonExtraActions } from "@/components/lessons/LessonExtraActions";
import { HomeworkInput } from "@/components/lessons/HomeworkInput";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { PageHeader } from "@/components/shared/PageHeader";
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
  const [params, setParams] = useSearchParams();
  const dateParam = params.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayKey;
  const isToday = date === todayKey;
  const selectDay = (d: string) => setParams(d === todayKey ? {} : { date: d }, { replace: true });

  const diary = usePresentationRead<{ tasks: Task[]; sessionsByTask: Record<number, Session[]> }>("tasks.diaryDate", [date]);
  const { tasks, sessionsByTask } = diary ?? { tasks: undefined, sessionsByTask: {} };
  const pendingAssignments = usePresentationRead<unknown[]>("assignments.pending");
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

  // Today's lessons from recurrences (with the matching slot for the day)
  const recurrences = usePresentationRead<LessonRecurrence[]>("recurrences.active");
  const todayLessons = useMemo(() => {
    const out: { rec: LessonRecurrence; slot: ReturnType<typeof slotForDate> }[] = [];
    for (const r of recurrences ?? []) {
      const slot = slotForDate(r, todayKey);
      if (slot) out.push({ rec: r, slot });
    }
    return out;
  }, [recurrences, todayKey]);


  // All-time sessions for streak calculation
  const allSessions = useSessions();
  const { streak, best: bestStreak } = useMemo(() => computeStreakFromSessions(allSessions ?? []), [allSessions]);

  const carryoverDays = profile?.carryoverDays ?? 2;
  const carryoverFrom = useMemo(() => {
    const d = new Date(now());
    d.setDate(d.getDate() - carryoverDays);
    return dayKey(d);
  }, [carryoverDays]);

  const carryoverTasks = usePresentationRead<Task[]>("tasks.carryover", [carryoverFrom, todayKey]);

  const [practiceTask, setPracticeTask] = useState<Task | null>(null);
  const [answersFor, setAnswersFor] = useState<{ itemId: number; title: string } | null>(null);
  const answeredItemIds = usePresentationRead<Set<number>>("helpRequests.answeredItemIds") ?? new Set<number>();
  const [confirmUncomplete, setConfirmUncomplete] = useState<Task | null>(null);
  const [carryPage, setCarryPage] = useState(0);
  const [selectedCarryIds, setSelectedCarryIds] = useState<number[]>([]);
  const [ignoredPage, setIgnoredPage] = useState(0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [completed, setCompleted] = useState<Task | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const CARRY_PAGE_SIZE = 4;
  const IGNORED_PAGE_SIZE = 5;

  const ignoredTasks = usePresentationRead<Task[]>("tasks.ignored", [carryoverFrom, todayKey]);

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

  const taskGroups = useMemo(() => {
    const groups = new Map<number, Task[]>();
    // Open tasks first; Array.sort is stable so the plan order is otherwise kept.
    for (const task of [...(filteredTasks ?? [])].sort((a, b) => Number(a.done) - Number(b.done))) {
      const group = groups.get(task.subjectId) ?? [];
      group.push(task);
      groups.set(task.subjectId, group);
    }
    return Array.from(groups, ([subjectId, items]) => ({ subjectId, items }));
  }, [filteredTasks]);

  const emptyQuote = useMemo(() => pickQuote(undefined, lang), [lang]);
  const heroQuote = useMemo(() => pickQuote(undefined, lang, todayKey), [lang, todayKey]);
  const showHeroQuote = profile?.hideHeroQuote !== true;

  const dot = (s?: Subject) => (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: subjectColorCss(s?.color, s?.type, s?.customColor) }}
      title={s?.name}
      role="img"
      aria-label={s?.name}
    />
  );
  const firstOpenId = filteredTasks?.find((x) => !x.done)?.id;

  // One-tap completion marks the task done; results are logged separately and never invented.
  const complete = async (task: Task) => {
    try {
      await tasksService.toggleDone(task.id!, true);
      setCompleted(task);
    } catch {
      toast.error(t("rate.failed"));
    }
  };
  const undoComplete = async () => {
    if (!completed?.id) return;
    const task = completed;
    setCompleted(null);
    await tasksService.toggleDone(task.id!, false);
    toast(t("toast.taskReopened"));
  };
  const picked = (filteredTasks ?? []).filter((x) => x.id !== undefined && pickedIds.includes(x.id));
  const tomorrow = dayKey(addDays(parseDayKey(todayKey), 1));
  const runBulk = async (action: (items: Task[]) => Promise<void>, messageKey: string) => {
    if (bulkBusy || !picked.length) return;
    const count = picked.length;
    setBulkBusy(true);
    try {
      await action(picked);
      toast.success(t(messageKey, { count }));
      setPickedIds([]);
    } catch {
      toast.error(t("diary.batchError"));
    } finally {
      setBulkBusy(false);
    }
  };
  const togglePicked = (id: number, on: boolean) => setPickedIds((prev) => (on ? [...prev.filter((v) => v !== id), id] : prev.filter((v) => v !== id)));
  const stopSelecting = () => { setSelecting(false); setPickedIds([]); };

  return (
    <div className="pb-24">
      <SessionFAB />

      <PageHeader
        title={isToday ? t("diary.hello", { name: profile?.name ?? "Musician" }) : t("diary.dayTasks")}
        subtitle={
          <span className="tabular-nums">
            {formatDate(date, lang, "long")}
            <span className="hidden min-[700px]:inline"> · </span>
            <span className="block min-[700px]:inline">{t("diary.doneSummary", { done: doneCount, total: totalCount })}</span>
          </span>
        }
      />

      <div className="grid gap-6 min-[901px]:grid-cols-[minmax(0,1fr)_260px] min-[1151px]:grid-cols-[minmax(0,1fr)_340px] min-[1151px]:gap-8">
        <div className="min-w-0 space-y-8">
          {pendingCount > 0 && (
            <Link to="/lessons/assignments" className="flex items-center gap-3 border-y border-destructive/40 py-3 text-sm font-medium text-destructive hover:bg-destructive/5">
              <LessonIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 tabular-nums">{t("diary.homework", { count: pendingCount })}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0" />
            </Link>
          )}

          {allDone && tasks && tasks.length > 0 && (
            <EndOfDaySummary tasks={tasks} sessionsByTask={sessionsByTask} t={t} navigate={navigate} />
          )}

          <section>
            <WeekStrip date={date} weekStartsOn={profile?.weekStartsOn ?? getDefaultWeekStartsOn(lang)} onSelect={selectDay} />
            <SectionHeader
              title={isToday ? t("diary.today") : formatDate(date, lang, "long")}
              action={
                <>
                  {!isToday && (
                    <Button size="sm" variant="ghost" onClick={() => selectDay(todayKey)}>{t("diary.backToToday")}</Button>
                  )}
                  <Link to="/tasks" className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                    <TasksIcon className="h-4 w-4" /> {t("common.all")}
                  </Link>
                </>
              }
            />
            <div className="mb-2 flex items-center justify-between gap-3 text-[0.8125rem] text-muted-foreground">
              <span className="tabular-nums">{t("diary.doneSummary", { done: doneCount, total: totalCount })}</span>
              {!!totalCount && (
                <Button size="sm" variant="ghost" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                  {selecting ? <Check /> : <CheckSquare />} {selecting ? t("diary.selectDone") : t("diary.select")}
                </Button>
              )}
            </div>
            <Progress value={totalCount ? (doneCount / totalCount) * 100 : 0} className="h-1.5" aria-label={t("diary.doneSummary", { done: doneCount, total: totalCount })} />
            <QuickAdd collapsible date={date} subjectId={selectedSubjectId} onAdded={(d) => d !== date && selectDay(d)} />

            {subjectFilterOptions.length > 1 && (
              <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
                {[null, ...subjectFilterOptions].map((subj) => {
                  const selected = (subj?.id ?? null) === selectedSubjectId;
                  return (
                    <button
                      key={subj?.id ?? "all"}
                      onClick={() => setSelectedSubjectId(subj?.id ?? null)}
                      aria-pressed={selected}
                      className={cn(
                        "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                        selected ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {subj && dot(subj)}
                      {subj ? subj.name : t("diary.allSubjects")}
                      <span className="font-numeric tabular-nums">{subj ? tasks?.filter((x) => x.subjectId === subj.id).length : tasks?.length}</span>
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
                cta={{ label: t("diary.beginTask"), onClick: () => navigate("/tasks/new", { state: { date } }) }}
              />
            ) : !filteredTasks?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <div className="space-y-6">
                {taskGroups.map(({ subjectId, items }) => {
                  const groupSubject = subjectMap.get(subjectId);
                  const completed = items.filter((task) => task.done).length;
                  return (
                    <section key={subjectId} aria-label={groupSubject?.name ?? t("diary.otherSubject")}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <h3 className="flex min-w-0 items-center gap-2 font-serif text-xl font-semibold">
                          {dot(groupSubject)}
                          <span className="break-words">{groupSubject?.name ?? t("diary.otherSubject")}</span>
                        </h3>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("diary.groupProgress", { done: completed, total: items.length })}</span>
                      </div>
                      <Progress value={(completed / items.length) * 100} className="h-1" aria-label={t("diary.groupProgress", { done: completed, total: items.length })} />
                      <ul className="divide-y divide-border">
                        {items.map((task) => {
                          const sess = (task.id && sessionsByTask[task.id]) || [];
                          const last = sess[sess.length - 1];
                          const left = !task.done && sess.length ? remainingSegmentIds(task.plan, sess).length : 0;
                          return (
                            <li key={task.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-[18px]">
                              {selecting ? (
                                <Checkbox
                                  className="mt-1 h-5 w-5"
                                  checked={task.id !== undefined && pickedIds.includes(task.id)}
                                  aria-label={t("diary.selectTask", { title: task.title })}
                                  onCheckedChange={(on) => task.id !== undefined && togglePicked(task.id, on === true)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  aria-label={task.done ? t("diary.markNotDone") : t("tasks.markDone")}
                                  onClick={() => (task.done ? setConfirmUncomplete(task) : void complete(task))}
                                  className={cn(
                                    "relative mt-0.5 grid h-6 w-6 shrink-0 before:absolute before:-inset-2.5 before:content-[''] place-items-center rounded-full border-2 transition-colors",
                                    task.done ? "border-primary bg-primary" : "border-muted-foreground hover:border-primary",
                                  )}
                                >
                                  {task.done && <CompleteIcon className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                                </button>
                              )}

                              <div className="min-w-[calc(100%-2.25rem)] flex-1 space-y-1 min-[700px]:min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (task.done && last) navigate(`/sessions/${last.id}`);
                                    else navigate(`/log?task=${task.id}`);
                                  }}
                                  className={cn("text-left text-base font-medium leading-snug break-words", task.done && "text-muted-foreground line-through")}
                                >
                                  {task.title}
                                </button>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                                  {planTempoLabel(task.plan) && <span>{planTempoLabel(task.plan)}</span>}
                                  {task.studyRoutineId && routineNames.get(task.studyRoutineId) && (
                                    <span>{t("diary.routine")}: {routineNames.get(task.studyRoutineId)}</span>
                                  )}
                                  {last && sessionLabel(last.marks) && <span className="text-primary">{sessionLabel(last.marks)}</span>}
                                  {left > 0 && <span>{t("diary.remaining", { count: left })}</span>}
                                </div>
                                {task.executionNotes && <p className="line-clamp-2 text-xs italic text-muted-foreground">{task.executionNotes}</p>}
                                {!task.done && task.itemId && <LastSessionStrip task={task} compact />}
                                {task.itemId && answeredItemIds.has(task.itemId) && (
                                  <button
                                    onClick={() => setAnswersFor({ itemId: task.itemId!, title: task.title })}
                                    className="flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
                                  >
                                    <MessageSquareQuote className="h-3.5 w-3.5" />
                                    {t("teacherAnswers.openLabel")}
                                  </button>
                                )}
                              </div>

                              {!task.done && !selecting && (
                                <Button
                                  variant={task.id === firstOpenId ? "default" : "outline"}
                                  onClick={() => setPracticeTask(task)}
                                  aria-label={`${t("diary.startPractice")}: ${task.title}`}
                                  className="max-[699px]:ml-9 max-[699px]:min-h-11"
                                >
                                  <PlayIcon /> {t("diary.start")}
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </section>

          {isToday && !!carryoverTasks?.length && (
            <section>
              <SectionHeader
                title={t("diary.unfinished")}
                action={<span className="text-xs tabular-nums text-muted-foreground">{t("diary.fromLastDays", { count: carryoverDays })}</span>}
              />
              <CarryoverBatchActions tasks={carryoverTasks} todayKey={todayKey} selectedIds={selectedCarryIds} onSelectionChange={setSelectedCarryIds} />
              {(() => {
                const totalPages = Math.max(1, Math.ceil(carryoverTasks.length / CARRY_PAGE_SIZE));
                const page = Math.min(carryPage, totalPages - 1);
                const slice = carryoverTasks.slice(page * CARRY_PAGE_SIZE, page * CARRY_PAGE_SIZE + CARRY_PAGE_SIZE);
                return (
                  <>
                    <ul className="divide-y divide-border">
                      {slice.map((task) => {
                        const subject = subjectMap.get(task.subjectId);
                        return (
                          <li key={task.id} className="flex items-center gap-3 py-3.5">
                            <Checkbox
                              checked={task.id !== undefined && selectedCarryIds.includes(task.id)}
                              aria-label={t("diary.selectTask", { title: task.title })}
                              onCheckedChange={(checked) => {
                                const id = task.id;
                                if (id === undefined) return;
                                setSelectedCarryIds((previous) => (checked ? [...previous.filter((value) => value !== id), id] : previous.filter((value) => value !== id)));
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="break-words text-sm font-medium">{task.title}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground tabular-nums">
                                {dot(subject)}
                                <span>{formatDate(task.date, lang, "short", true)}</span>
                                {planTempoLabel(task.plan) && <span>{planTempoLabel(task.plan)}</span>}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="min-h-11 sm:min-h-0"
                              aria-label={t("diary.moveToToday")}
                              onClick={async () => {
                                if (!task.id) return;
                                await tasksService.carryOver(task, todayKey);
                                toast.success(t("toast.movedToToday"));
                              }}
                            >
                              <CarryOverIcon /> {t("common.today")}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-11 w-11 sm:h-9 sm:w-9"
                              aria-label={t("common.ignore")}
                              onClick={async () => {
                                if (!task.id) return;
                                await tasksService.skip(task.id);
                                toast(t("toast.ignored"));
                              }}
                            >
                              <CloseIcon />
                            </Button>
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

          {isToday && !!ignoredTasks?.length &&
            (() => {
              const totalPages = Math.max(1, Math.ceil(ignoredTasks.length / IGNORED_PAGE_SIZE));
              const page = Math.min(ignoredPage, totalPages - 1);
              const slice = ignoredTasks.slice(page * IGNORED_PAGE_SIZE, page * IGNORED_PAGE_SIZE + IGNORED_PAGE_SIZE);
              return (
                <details className="group border-t border-border pt-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground">
                    <HideIcon className="h-4 w-4" /> {t("diary.ignored", { count: ignoredTasks.length })}
                  </summary>
                  <ul className="mt-3 divide-y divide-border">
                    {slice.map((task) => (
                      <li key={task.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-medium">{task.title}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {formatDate(task.date, lang, "short", true)}
                            {planTempoLabel(task.plan) && <> · {planTempoLabel(task.plan)}</>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          aria-label={t("diary.unignore")}
                          onClick={async () => {
                            if (!task.id) return;
                            await tasksService.unskip(task.id);
                            toast.success(t("toast.restored"));
                          }}
                        >
                          <ResetIcon /> {t("diary.unignore")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Pager page={page} totalPages={totalPages} onChange={setIgnoredPage} />
                </details>
              );
            })()}
        </div>

        <aside className="min-w-0 space-y-6 min-[901px]:space-y-8">
          {todayLessons.map(({ rec, slot }) => (
            <LessonTodayBanner key={`${rec.id}-${slot?.dayOfWeek}-${slot?.startTime}`} rec={rec} slot={slot} subjects={subjects ?? []} t={t} navigate={navigate} />
          ))}

          {streak > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("diary.continuity")}</h3>
              <p className="flex items-baseline gap-2">
                <strong className="font-numeric text-xl font-semibold tabular-nums">{t("common.daysShort", { count: streak })}</strong>
                {bestStreak > streak && <span className="text-xs text-muted-foreground">· {t("diary.bestStreak", { count: bestStreak })}</span>}
              </p>
              <Link to="/analytics" className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
                {t("nav.progress")} <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </section>
          )}

          {showHeroQuote && (
            <figure className="border-t border-border pt-5">
              <p className="font-serif text-xl italic leading-snug text-foreground/80">«{heroQuote.text}»</p>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">{heroQuote.author}</figcaption>
            </figure>
          )}
        </aside>
      </div>

      {completed && (
        <CompletionBar
          key={completed.id}
          task={completed}
          onClose={() => setCompleted(null)}
          onUndo={() => void undoComplete()}
          onLog={() => { const id = completed.id; setCompleted(null); navigate(`/log?task=${id}`); }}
        />
      )}

      {selecting && (
        <div
          role="toolbar"
          aria-label={t("diary.selectionBar")}
          className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-[60] flex max-w-[760px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-border bg-card px-3.5 py-2.5 shadow-raised min-[700px]:bottom-5 min-[700px]:left-[calc(195px+2rem)] min-[700px]:right-8 min-[1151px]:left-[calc(208px+2rem)] min-[1600px]:left-[calc(250px+2rem)]"
        >
          <span className="text-sm"><strong className="font-numeric font-semibold tabular-nums">{t("diary.selectedCount", { count: picked.length })}</strong></span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPickedIds((filteredTasks ?? []).flatMap((x) => (x.id === undefined ? [] : [x.id])))}>{t("common.all")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setPickedIds([])}>{t("common.none")}</Button>
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Button size="sm" disabled={bulkBusy || !picked.length} onClick={() => runBulk(async (items) => { await tasksService.bulkSetDone(items.filter((x) => !x.done).flatMap((x) => (x.id === undefined ? [] : [x.id])), true); }, "diary.bulkDone")}>
              <Check />{t("diary.bulkComplete")}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy || !picked.length} onClick={() => runBulk(async (items) => { for (const x of items) if (!x.done) await tasksService.update(x.id!, { date: tomorrow }); }, "diary.bulkMoved")}>
              <CalendarPlus />{t("diary.bulkTomorrow")}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy || !picked.length} onClick={() => runBulk(async (items) => { for (const x of items) await tasksService.skip(x.id!); }, "toast.ignored")}>
              <Archive />{t("diary.bulkArchive")}
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={bulkBusy || !picked.length} onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 />{t("diary.bulkDelete")}
            </Button>
          </span>
        </div>
      )}

      {practiceTask && (
        <PracticeMode
          task={practiceTask}
          onClose={() => setPracticeTask(null)}
          onFinish={({ marks }) => {
            navigate(`/log?task=${practiceTask.id}`, { state: { prefill: { marks } } });
            setPracticeTask(null);
          }}
          onShowAnswers={
            practiceTask.itemId && answeredItemIds.has(practiceTask.itemId)
              ? () => setAnswersFor({ itemId: practiceTask.itemId!, title: practiceTask.title })
              : undefined
          }
        />
      )}
      {answersFor && (
        <TeacherAnswersSheet
          open={answersFor !== null}
          onOpenChange={(o) => { if (!o) setAnswersFor(null); }}
          itemId={answersFor.itemId}
          itemTitle={answersFor.title}
        />
      )}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("diary.bulkDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("diary.bulkDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => runBulk(async (items) => { await tasksService.bulkRemove(items.map((x) => x.id!)); }, "diary.bulkRemoved")}
            >
              {t("diary.bulkDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  slot,
  subjects,
  t,
  navigate,
}: {
  rec: LessonRecurrence;
  slot?: ReturnType<typeof slotForDate>;
  subjects: Subject[];
  t: (k: string, v?: Record<string, string | number>) => string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const subject = subjects.find((s) => s.id === rec.subjectId);
  const link = "inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4";
  return (
    <div className="rounded-[14px] bg-card p-6 shadow-soft">
      <h3 className="text-xs font-medium uppercase tracking-wider text-primary">
        {rec.teacher ? t("diary.lessonTodayWith", { teacher: rec.teacher }) : t("diary.lessonToday")}
      </h3>
      {(subject || slot) && (
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {subject?.name}{subject && slot ? " · " : ""}{slot ? slot.startTime : ""}
        </p>
      )}
      <HomeworkInput recurrence={rec} date={today()} className="mt-3 flex gap-2" />
      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        <button onClick={() => navigate("/lessons", { state: { openLogForRecurrenceId: rec.id, date: today() } })} className={link}>
          {t("diary.logLessonShort")} <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <LessonExtraActions subjectId={rec.subjectId} />
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
    <div className="space-y-3 border-y border-primary/30 py-5">
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
              {last && sessionLabel(last.marks) && <span className="text-xs tabular-nums text-muted-foreground">{sessionLabel(last.marks)}</span>}
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
