import { useMemo, useState } from "react";
import { useActiveTasks, useAssignments, useSessions, useStudyRoutines, useSubjects } from "@/presentation/hooks/useEntities";
import { assignmentsToPlan } from "@/presentation/utils/assignments";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Task } from "@/domain/entities/task";
import type { Session } from "@/domain/entities/session";
import type { Profile } from "@/domain/entities/profile";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import type { Subject } from "@/domain/entities/common";
import { remainingSegmentIds } from "@/domain/logic/plan";
import { tasksService, sessionsService } from "@/lib/services";
import { useI18n } from "@/lib/i18n";
import { today, dayKey, formatDate, now, addDays, parseDayKey } from "@/lib/date";
import { slotForDate } from "@/lib/recurrence";
import { computeStreakFromSessions } from "@/lib/domain/streak";
import { sortDiaryTasks, type DiaryTaskOrder } from "@/lib/domain/taskOrder";
import { planTempoLabel, sessionLabel } from "@/lib/format";
import { subjectColorCss } from "@/lib/subjectColors";
import { CompleteIcon, PlayIcon, CarryOverIcon, CloseIcon, ResetIcon, HideIcon, LessonIcon, ArrowRightIcon, SessionIcon } from "@/lib/icons";
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
import { WeekStrip } from "@/components/diary/WeekStrip";
import { LessonExtraActions } from "@/components/lessons/LessonExtraActions";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { PageHeader } from "@/components/shared/PageHeader";
import { FloatingActions } from "@/components/shared/FloatingActions";
import { FilterPanel, FilterSelect } from "@/components/shared/FilterPanel";

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
import { liveLessonPath } from "@/lib/liveLesson";
import { useLiveLesson } from "@/presentation/hooks/useLiveLesson";
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
  // Same rule as the nav badge and Lessons: homework whose tasks were all deleted is pending again.
  const pendingCount = assignmentsToPlan(useAssignments(), useActiveTasks()).length;

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
  // Sessions logged without a task have no row of their own: list them so a free session never vanishes from its day.
  const freeSessions = useMemo(() => (allSessions ?? []).filter((s) => s.date === date && s.taskId === undefined), [allSessions, date]);

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
  const [taskOrder, setTaskOrder] = useState<DiaryTaskOrder>("routine");
  const [completed, setCompleted] = useState<{ task: Task; viaKeyboard: boolean } | null>(null);
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
    const groups: { subjectId: number; items: Task[] }[] = [];
    for (const task of sortDiaryTasks(filteredTasks ?? [], studyRoutines ?? [], taskOrder, lang)) {
      const previous = groups.at(-1);
      if (previous?.subjectId === task.subjectId) previous.items.push(task);
      else groups.push({ subjectId: task.subjectId, items: [task] });
    }
    return groups;
  }, [filteredTasks, studyRoutines, taskOrder, lang]);

  const emptyQuote = useMemo(() => pickQuote(undefined, lang), [lang]);
  const heroQuote = useMemo(() => pickQuote(undefined, lang, todayKey), [lang, todayKey]);
  const showHeroQuote = profile?.hideHeroQuote !== true;

  const dot = (s?: Subject, decorative = false) => (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: subjectColorCss(s?.color, s?.type, s?.customColor) }}
      {...(decorative ? { "aria-hidden": true } : { title: s?.name, role: "img", "aria-label": s?.name })}
    />
  );

  // One-tap completion marks the task done; results are logged separately and never invented.
  const complete = async (task: Task, viaKeyboard = false) => {
    try {
      await tasksService.toggleDone(task.id!, true);
      setCompleted({ task, viaKeyboard });
    } catch {
      toast.error(t("rate.failed"));
    }
  };
  const reopen = async (task: Task) => {
    const logged = (sessionsByTask[task.id!] ?? []).some((s) => s.date === task.date);
    if (logged) return setConfirmUncomplete(task);
    await tasksService.toggleDone(task.id!, false);
    toast(t("toast.taskReopened"));
  };
  const undoComplete = async () => {
    if (!completed?.task.id) return;
    const { task } = completed;
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

      <PageHeader
        title={isToday ? t("diary.hello", { name: profile?.name ?? "Musician" }) : t("diary.dayTasks")}
        actions={<SessionFAB short />}
      />
      {todayLessons.length > 0 && (
        <div className="mb-6 space-y-4">
          {todayLessons.map(({ rec, slot }) => (
            <LessonTodayBanner key={`${rec.id}-${slot?.dayOfWeek}-${slot?.startTime}`} rec={rec} slot={slot} subjects={subjects ?? []} t={t} />
          ))}
        </div>
      )}
      <div className="-mt-3 mb-6">
        <WeekStrip date={date} onSelect={selectDay} />
      </div>

      <div className="grid gap-8 min-[1151px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          {pendingCount > 0 && (
            <Link to="/lessons/assignments" className="flex items-center gap-3 rounded-lg bg-warning-subtle px-3 py-3 text-sm font-medium text-warning hover:underline underline-offset-4">
              <LessonIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 tabular-nums">{t("diary.homework", { count: pendingCount })}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0" />
            </Link>
          )}

          {allDone && tasks && tasks.length > 0 && (
            <EndOfDaySummary count={tasks.length} t={t} navigate={navigate} />
          )}

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
              {!!totalCount && <span className="tabular-nums">{t("diary.doneSummary", { done: doneCount, total: totalCount })}</span>}
              <span className="flex flex-wrap items-center gap-1">
                {!isToday && <Button size="sm" variant="ghost" className="max-sm:min-h-11" onClick={() => selectDay(todayKey)}>{t("diary.backToToday")}</Button>}
                {!!totalCount && (
                  <Button size="sm" variant="ghost" className="max-sm:min-h-11" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                    {selecting ? <Check /> : <CheckSquare />} {selecting ? t("diary.selectDone") : t("common.select")}
                  </Button>
                )}
              </span>
            </div>
            {!!totalCount && <Progress value={(doneCount / totalCount) * 100} className="h-1.5 [&>div]:bg-success" aria-label={t("diary.doneSummary", { done: doneCount, total: totalCount })} />}

            {(!!totalCount || subjectFilterOptions.length > 1) && (
              <FilterPanel filters={selectedSubjectId === null ? [] : [{ key: "subject", label: `${t("common.subject")}: ${subjectMap.get(selectedSubjectId)?.name ?? selectedSubjectId}`, onRemove: () => setSelectedSubjectId(null) }]} onReset={() => setSelectedSubjectId(null)} resultCount={filteredTasks?.length}
                sorting={!!totalCount && <FilterSelect label={t("diary.sortTasks")} value={taskOrder} onChange={setTaskOrder} options={[
                  { value: "routine", label: t("diary.sortRoutine") },
                  { value: "title", label: t("diary.sortTitle") },
                  { value: "created", label: t("diary.sortCreated") },
                ]} />}>
                {subjectFilterOptions.length > 1 && <FilterSelect label={t("common.subject")} value={selectedSubjectId === null ? "all" : String(selectedSubjectId)} onChange={value => setSelectedSubjectId(value === "all" ? null : Number(value))} options={[
                  { value: "all", label: `${t("diary.allSubjects")} (${tasks?.length ?? 0})` },
                  ...subjectFilterOptions.map(s => ({ value: String(s.id), label: `${s.name} (${tasks?.filter(task => task.subjectId === s.id).length ?? 0})` })),
                ]} />}
              </FilterPanel>
            )}

            {tasks === undefined ? (
              <div className="space-y-2">
                <div className="paper-skeleton h-20" />
                <div className="paper-skeleton h-20" />
              </div>
            ) : !tasks?.length ? (
              allSessions?.length === 0 ? (
                <EmptyState
                  title={t("diary.firstTitle")}
                  hint={t("diary.firstHint")}
                  cta={{ label: t("rate.logResults"), icon: SessionIcon, onClick: () => navigate("/log") }}
                  secondary={{ label: t("diary.beginTask"), onClick: () => navigate("/tasks/new", { state: { date } }) }}
                />
              ) : (
                <EmptyState
                  hint={t("diary.empty")}
                  quote={showHeroQuote ? undefined : emptyQuote}
                  cta={{ label: t("diary.beginTask"), onClick: () => navigate("/tasks/new", { state: { date } }) }}
                />
              )
            ) : !filteredTasks?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <div className="space-y-6">
                {taskGroups.map(({ subjectId, items }, groupIndex) => {
                  const groupSubject = subjectMap.get(subjectId);
                  const completed = items.filter((task) => task.done).length;
                  return (
                    <section key={`${subjectId}-${groupIndex}`} aria-label={groupSubject?.name ?? t("diary.otherSubject")}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <h2 className="flex min-w-0 items-center gap-2 font-serif text-xl font-semibold">
                          {dot(groupSubject, true)}
                          <span className="break-words">{groupSubject?.name ?? t("diary.otherSubject")}</span>
                        </h2>
                        {taskGroups.length > 1 && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("diary.groupProgress", { done: completed, total: items.length })}</span>}
                      </div>
                      <ul className="divide-y divide-border">
                        {items.map((task) => {
                          const sess = (task.id && sessionsByTask[task.id]) || [];
                          const last = sess[sess.length - 1];
                          const left = !task.done && sess.length ? remainingSegmentIds(task.plan, sess).length : 0;
                          return (
                            <li key={task.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 py-5">
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
                                  title={task.done ? t("diary.markNotDone") : t("tasks.markDone")}
                                  // detail 0: activated from the keyboard, so the completion bar takes focus.
                                  onClick={(e) => void (task.done ? reopen(task) : complete(task, e.detail === 0))}
                                  className={cn(
                                    "relative mt-0.5 grid h-6 w-6 shrink-0 before:absolute before:-inset-2.5 before:content-[''] place-items-center rounded-full border-2 transition-colors",
                                    task.done ? "border-success bg-success" : "border-muted-foreground hover:border-primary",
                                  )}
                                >
                                  {task.done && <CompleteIcon className="h-3.5 w-3.5 text-success-foreground" strokeWidth={3} />}
                                </button>
                              )}

                              <div className="min-w-0 space-y-1 min-[700px]:grid min-[700px]:grid-cols-[minmax(0,1fr)_minmax(7rem,.45fr)] min-[700px]:gap-x-4 min-[700px]:gap-y-2 min-[700px]:space-y-0 min-[700px]:[&>*:nth-child(n+3)]:col-span-full">
                                <div className={cn("text-left text-base font-medium leading-snug break-words", task.done && "text-muted-foreground line-through")}>
                                  {task.done && last ? <Link to={`/sessions/${last.id}`}>{task.title}</Link> : task.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums min-[700px]:flex-col min-[700px]:items-end min-[700px]:text-right">
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
                                    className="flex min-h-11 w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
                                  >
                                    <MessageSquareQuote className="h-3.5 w-3.5" />
                                    {t("teacherAnswers.openLabel")}
                                  </button>
                                )}
                              </div>

                              {!selecting && (
                                <div className="col-start-2 flex flex-wrap items-center justify-end gap-2">
                                {!task.done && <Button
                                  onClick={() => setPracticeTask(task)}
                                  aria-label={`${t("diary.startPractice")}: ${task.title}`}
                                  className="min-h-11 px-3"
                                >
                                  <PlayIcon /> {t("diary.start")}
                                </Button>}
                                <Button asChild variant="ghost" className="min-h-11 px-2">
                                  <Link to={`/log?task=${task.id}`} aria-label={`${t("diary.logResults")}: ${task.title}`}>{t("diary.logResults")}</Link>
                                </Button>
                                </div>
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

          {!!freeSessions.length && (
            <section>
              <SectionHeader title={t("diary.freeSessions")} />
              <ul className="divide-y divide-border">
                {freeSessions.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sessions/${s.id}`} className="flex min-h-11 items-center justify-between gap-3 py-3 hover:underline underline-offset-4">
                      <span className="min-w-0 break-words text-sm font-medium">{s.snapshot?.taskTitle ?? t("logPage.free")}</span>
                      {sessionLabel(s.marks) && <span className="shrink-0 text-xs tabular-nums text-primary">{sessionLabel(s.marks)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isToday && !!carryoverTasks?.length && (
            <section>
              <SectionHeader
                title={t("diary.unfinished")}
                action={<span className="text-xs tabular-nums text-muted-foreground">{t("diary.fromLastDays", { count: carryoverDays })}</span>}
              />
              {carryoverTasks.length > 1 && <CarryoverBatchActions tasks={carryoverTasks} todayKey={todayKey} selectedIds={selectedCarryIds} onSelectionChange={setSelectedCarryIds} />}
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
                              className="h-11 w-11"
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
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground">
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
                          className="max-sm:min-h-11"
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
          {streak > 0 && (
            <section>
              <h2 className="mb-1 font-sans text-sm font-medium text-muted-foreground">{t("diary.continuity")}</h2>
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
          key={completed.task.id}
          task={completed.task}
          focusUndo={completed.viaKeyboard}
          onClose={() => setCompleted(null)}
          onUndo={() => void undoComplete()}
          onLog={() => { const id = completed.task.id; setCompleted(null); navigate(`/log?task=${id}`); }}
        />
      )}

      {selecting && (
        <FloatingActions
          role="toolbar"
          aria-label={t("diary.selectionBar")}
          className="max-w-[760px] flex-wrap justify-between gap-x-4 gap-y-2 px-3.5 py-2.5 [&_button]:max-sm:min-h-11"
        >
          <span className="text-sm"><strong className="font-numeric font-semibold tabular-nums">{t("diary.selectedCount", { count: picked.length })}</strong></span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPickedIds((filteredTasks ?? []).flatMap((x) => (x.id === undefined ? [] : [x.id])))}>{t("common.all")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setPickedIds([])}>{t("common.none")}</Button>
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Button size="sm" disabled={bulkBusy || !picked.length} onClick={() => runBulk(async (items) => { await tasksService.bulkSetDone(items.filter((x) => !x.done).flatMap((x) => (x.id === undefined ? [] : [x.id])), true); }, "toast.tasksBulkDone")}>
              <Check />{t("diary.bulkComplete")}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy || !picked.length} onClick={() => runBulk(async (items) => { for (const x of items) if (!x.done) await tasksService.update(x.id!, { date: tomorrow }); }, "diary.bulkMoved")}>
              <CalendarPlus />{t("diary.bulkTomorrow")}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy || !picked.length} onClick={() => runBulk(async (items) => { for (const x of items) await tasksService.skip(x.id!); }, "toast.ignored")}>
              <Archive />{t("diary.bulkArchive")}
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={bulkBusy || !picked.length} onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 />{t("common.delete")}
            </Button>
          </span>
        </FloatingActions>
      )}

      {practiceTask && (
        <PracticeMode
          task={practiceTask}
          onClose={() => setPracticeTask(null)}
          onFinish={({ marks, clips }) => {
            navigate(`/log?task=${practiceTask.id}`, { state: { prefill: { marks, clips } } });
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
              {t("common.delete")}
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
}: {
  rec: LessonRecurrence;
  slot?: ReturnType<typeof slotForDate>;
  subjects: Subject[];
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const subject = subjects.find((s) => s.id === rec.subjectId);
  const live = useLiveLesson();
  return (
    <div className="rounded-lg bg-info-subtle p-6 shadow-soft">
      <h2 className="font-sans text-sm font-semibold text-info">
        {rec.teacher ? t("diary.lessonTodayWith", { teacher: rec.teacher }) : t("diary.lessonToday")}
      </h2>
      {(subject || slot) && (
        <p className="mt-1 break-words text-sm text-info">
          {subject?.name}{subject && slot ? " · " : ""}{slot ? slot.startTime : ""}
        </p>
      )}
      <Button asChild className="mt-3 min-h-11">
        <Link to={live ?? liveLessonPath({ recurrenceId: rec.id, date: today() })}>
          {t(live ? "lessonLive.resume" : "lessonLive.title")} <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </Button>
      <LessonExtraActions subjectId={rec.subjectId} />
    </div>
  );
}

function EndOfDaySummary({
  count,
  t,
  navigate,
}: {
  count: number;
  t: (k: string, v?: Record<string, string | number>) => string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-success-subtle px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <SessionIcon className="h-5 w-5 shrink-0" />
        {t("toast.tasksBulkDone", { count })}
      </p>
      <Button size="sm" variant="ghost" className="text-success max-sm:min-h-11" onClick={() => navigate("/history")}>
        {t("diary.viewHistory")} <ArrowRightIcon className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
