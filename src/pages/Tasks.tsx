import { useMemo, useState } from "react";
import type { Task } from "@/domain/entities/task";
import type { StudyRoutine } from "@/domain/ports/studyRoutine";
import { useActiveTasks, useStudyRoutines, useSubjects } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { formatDate, today } from "@/lib/date";
import type { Lang } from "@/domain/entities/common";
import { studyRoutinesService, tasksService } from "@/lib/services";
import { deleteWithUndo } from "@/presentation/utils/deleteWithUndo";
import { NOTE_GLYPH } from "@/lib/constants";
import { subjectColorCss } from "@/lib/subjectColors";


import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Pencil, Plus, RefreshCw, RotateCcw, SearchX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickAdd } from "@/components/diary/QuickAdd";

import { TaskCalendarView } from "@/components/diary/TaskCalendarView";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pager } from "@/components/shared/Pager";
import { firstTempo } from "@/domain/logic/plan";
import { usePagination } from "@/hooks/usePagination";

const PAGE_SIZE = 8;
type Tab = "tasks" | "series" | "routines" | "calendar";
const TABS: Tab[] = ["tasks", "series", "routines", "calendar"];

function summarizeRecurrence(
  rec: NonNullable<Task["recurrence"]>,
  t: (key: string, vars?: Record<string, string | number>) => string,
  lang: Lang,
): string {
  const parts: string[] = [];
  if (rec.kind === "weekdays") {
    const days = (rec.days ?? []).map((d) => t(`weekday.${d}`)).join(", ");
    parts.push(days || "—");
  } else {
    parts.push(t("recurrence.summaryEvery", { count: rec.everyXDays ?? 1 }));
  }
  if (rec.endDate) parts.push(t("recurrence.summaryUntil", { date: formatDate(rec.endDate, lang) }));
  else if (rec.occurrences) parts.push(t("recurrence.summaryOccurrences", { count: rec.occurrences }));
  return parts.join(" · ");
}

export default function Tasks() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const tasks = useActiveTasks();
  const subjects = useSubjects();
  const routines = useStudyRoutines() ?? [];

  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((x) => x === params.get("tab")) ?? "tasks";
  const [filter, setFilter] = useState<"all" | "active" | "done">("active");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const [delRoutineId, setDelRoutineId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [delId, setDelId] = useState<number | null>(null);
  const [delMode, setDelMode] = useState<"one" | "series">("one");

  const filtered = useMemo(() => {
    let arr = (tasks ?? []).filter((task) => tab !== "series" || !!task.recurrence);
    if (filter === "active") arr = arr.filter((task) => !task.done);
    if (filter === "done") arr = arr.filter((task) => task.done);
    if (subjectFilter !== "all") arr = arr.filter((task) => task.subjectId === Number(subjectFilter));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((task) => task.title.toLowerCase().includes(needle));
    }
    return [...arr].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    });
  }, [tasks, tab, filter, subjectFilter, q]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";



  const askDelete = async (task: Task) => {
    if (!task.id) return;
    const isSeries = !!(task.recurrence || task.recurrenceTaskId);
    if (isSeries) {
      // Series delete always needs a dialog (one vs. all choice)
      setDelId(task.id);
      setDelMode("one");
      return;
    }
    if (await tasksService.hasSessions(task.id)) {
      // Has sessions → will be archived (soft delete) — keep dialog so user knows data is preserved
      setDelId(task.id);
      setDelMode("one");
      return;
    }
    // No sessions, no series → low-risk hard delete: skip dialog, offer undo
    const saved = { ...task };
    await deleteWithUndo({
      remove: () => tasksService.hardDelete(task.id),
      restore: () => tasksService.restore(saved),
      message: t("toast.taskDeleted"),
      undoLabel: t("common.undo"),
      toast: (msg, opts) => toast.success(msg, opts),
      duration: 5000,
    });
  };

  const confirmDelete = async () => {
    if (delId == null) return;
    const target = tasks?.find((task) => task.id === delId);
    if (!target) return;
    if (delMode === "series") {
      const seriesId = target.recurrence ? target.id : target.recurrenceTaskId;
      const { soft } = seriesId
        ? await tasksService.removeSeries(seriesId)
        : await tasksService.bulkRemove([delId]);
      toast.success(soft
        ? t("toast.seriesRemoved", { count: soft })
        : t("toast.seriesDeleted"));
    } else {
      const mode = await tasksService.remove(delId);
      toast.success(mode === "soft" ? t("toast.taskArchived") : t("toast.taskDeleted"));
    }
    setDelId(null);
  };




  // ── Study routine helpers ──────────────────────────────────────
  const DAY_SHORT = [t("weekday.0"), t("weekday.1"), t("weekday.2"), t("weekday.3"), t("weekday.4"), t("weekday.5"), t("weekday.6")];
  const summarizeRoutineDays = (matrix: StudyRoutine["matrix"]) => {
    const days = Object.keys(matrix)
      .map(Number)
      .filter((d) => Object.values(matrix[String(d)] ?? {}).some((c) => c > 0))
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return days.map((d) => DAY_SHORT[d]).join(", ") || "—";
  };
  const confirmDeleteRoutine = async () => {
    if (delRoutineId == null) return;
    await studyRoutinesService.remove(delRoutineId);
    toast.success(t("toast.routineDeleted"));
    setDelRoutineId(null);
  };

  const handleRegenerate = async (routine: StudyRoutine) => {
    if (!routine.id || regeneratingId != null) return;
    setRegeneratingId(routine.id);
    try {
      await studyRoutinesService.regenerateFromDate(routine, new Date().toISOString().slice(0, 10));
      toast.success(t("toast.routineRegenerated"));
    } finally {
      setRegeneratingId(null);
    }
  };

  const dot = (subjectId: number) => {
    const s = subjects?.find((x) => x.id === subjectId);
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(s?.color, s?.type, s?.customColor) }} title={s?.name} role="img" aria-label={s?.name} />;
  };
  const setTab = (next: Tab) => { setParams(next === "tasks" ? {} : { tab: next }, { replace: true }); setPage(0); };
  const subtitle = { tasks: "plan.subtitle", series: "plan.subtitle", routines: "plan.subtitleRoutines", calendar: "plan.subtitleCalendar" }[tab];

  return (
    <div className="pb-24">
      <PageHeader
        title={t("nav.plan")}
        subtitle={t(subtitle)}
        actions={
          <Button onClick={() => navigate(tab === "routines" ? "/tasks/routines/new" : "/tasks/new")}>
            <Plus /> {tab === "routines" ? t("plan.newRoutine") : t("diary.newTask")}
          </Button>
        }
      />

      <div role="tablist" className="mb-5 flex gap-6 overflow-x-auto border-b border-border no-scrollbar overflow-y-hidden">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px shrink-0 border-b-2 pb-2 text-sm font-medium transition-colors ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t(`plan.tab.${id}`)}
            {id === "tasks" && tasks !== undefined && <span className="ml-1.5 font-numeric text-xs tabular-nums">{tasks.length}</span>}
          </button>
        ))}
      </div>

      {tab === "calendar" ? (
        tasks !== undefined && <TaskCalendarView subjects={subjects ?? []} />
      ) : tab === "routines" ? (
        routines.length === 0 ? (
          <EmptyState
            title={t("plan.noRoutines")}
            hint={t("plan.noRoutinesHint")}
            cta={{ label: t("plan.createRoutine"), onClick: () => navigate("/tasks/routines/new") }}
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {routines.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-base font-medium leading-snug">{r.name ?? subjectName(r.subjectId)}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground tabular-nums">
                    {dot(r.subjectId)}
                    <span>{r.groups.length} {t("studyRoutine.groupsLabel", { count: r.groups.length })}</span>
                    <span>{summarizeRoutineDays(r.matrix)}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleRegenerate(r)} disabled={regeneratingId === r.id}>
                  <RefreshCw className={regeneratingId === r.id ? "animate-spin" : ""} />
                  <span className="max-[699px]:sr-only">{t("studyRoutine.regenerate")}</span>
                </Button>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label={`${t("common.edit")} ${r.name ?? ""}`} onClick={() => navigate(`/tasks/routines/edit/${r.id}`)}><Pencil /></Button>
                <Button size="icon" variant="ghost" className="h-10 w-10 hover:text-destructive" aria-label={`${t("common.delete")} ${r.name ?? ""}`} onClick={() => r.id && setDelRoutineId(r.id)}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {tab === "tasks" && <QuickAdd date={today()} subjectId={subjectFilter === "all" ? null : Number(subjectFilter)} onAdded={() => undefined} />}
          <div className="my-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
            <Input type="search" aria-label={t("tasks.searchByTitle")} placeholder={t("tasks.searchByTitle")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(0); }}>
              <SelectTrigger aria-label={t("common.subject")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("library.allSubjects")}</SelectItem>
                {(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(0); }}>
              <SelectTrigger aria-label={t("plan.status")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="active">{t("plan.statusOpen")}</SelectItem>
                <SelectItem value="done">{t("common.done")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tasks === undefined ? (
            <ListSkeleton />
          ) : pageItems.length === 0 ? (
            <EmptyState icon={SearchX} title={t("plan.noMatch")} hint={t("plan.noMatchHint")} cta={{ label: t("states.clearFilters"), icon: RotateCcw, onClick: () => { setQ(""); setSubjectFilter("all"); setFilter("all"); } }} />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {pageItems.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/tasks/edit/${task.id}`} className={`break-words text-base font-medium leading-snug hover:underline underline-offset-4 ${task.done ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                      {dot(task.subjectId)}
                      {task.done && <span className="inline-flex items-center gap-1 text-primary"><Check className="h-3.5 w-3.5" />{t("plan.done")}</span>}
                      <span>{task.recurrence ? t("tasks.fromDate", { date: formatDate(task.date, lang) }) : formatDate(task.date, lang, "medium")}</span>
                      {task.recurrence && <span>{summarizeRecurrence(task.recurrence, t, lang)}</span>}
                      {firstTempo(task.plan) && <span>{NOTE_GLYPH[firstTempo(task.plan)!.noteVal ?? "quarter"]} = {firstTempo(task.plan)!.bpm}</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-10 w-10" aria-label={t("plan.editTask", { title: task.title })} onClick={() => navigate(`/tasks/edit/${task.id}`)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10 hover:text-destructive" aria-label={t("plan.deleteTask", { title: task.title })} onClick={() => askDelete(task)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <AlertDialog open={delRoutineId !== null} onOpenChange={(o) => !o && setDelRoutineId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteRoutine")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialog.deleteRoutineDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoutine} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delId !== null} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteTask")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const target = tasks?.find((x) => x.id === delId);
                if (!target) return null;
                if (target.recurrence || target.recurrenceTaskId) {
                  return (
                    <span className="block space-y-2">
                      <span>{t("tasks.partOfSeries")}</span>
                      <span className="flex gap-2 mt-2">
                        <button
                          onClick={() => setDelMode("one")}
                          className={`text-xs px-3 py-1 rounded-full border ${delMode === "one" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                        >{t("tasks.justThisOne")}</button>
                        <button
                          onClick={() => setDelMode("series")}
                          className={`text-xs px-3 py-1 rounded-full border ${delMode === "series" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                        >{t("tasks.entireSeries")}</button>
                      </span>
                    </span>
                  );
                }
                return t("tasks.cannotBeUndone");
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
