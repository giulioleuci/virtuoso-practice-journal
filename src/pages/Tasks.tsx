import { useMemo, useState } from "react";
import { type Task, type StudyRoutine } from "@/lib/db";
import { useActiveTasks, useStudyRoutines, useSubjects } from "@/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import type { Lang } from "@/lib/db";
import { studyRoutinesService, tasksService, deleteWithUndo } from "@/lib/services";
import { NOTE_GLYPH } from "@/lib/constants";
import { subjectBorderStyle } from "@/lib/subjectColors";


import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Pencil, Trash2, RefreshCw, CalendarRange, MoreVertical } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TaskCalendarView } from "@/components/diary/TaskCalendarView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { usePagination } from "@/hooks/usePagination";

const PAGE_SIZE = 5;

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

  const [view, setView] = useState<"series" | "routines">("series");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const [delRoutineId, setDelRoutineId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [delId, setDelId] = useState<number | null>(null);
  const [delMode, setDelMode] = useState<"one" | "series">("one");

  const filtered = useMemo(() => {
    let arr = (tasks ?? []).filter((task) => !!task.recurrence);
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
  }, [tasks, filter, subjectFilter, q]);

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
  const totalPerWeek = (matrix: StudyRoutine["matrix"]) =>
    Object.values(matrix).reduce(
      (sum, day) => sum + Object.values(day).reduce((a, b) => a + b, 0),
      0,
    );

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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></Link>
        <h2 className="font-serif text-3xl flex-1">{t("tasks.allTasks")}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {view === "series" ? filtered.length : routines.length}
        </span>
      </div>

      <Tabs value={view} onValueChange={(v) => { setView(v as typeof view); setPage(0); }}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="series">{t("tasks.recurringSeries")}</TabsTrigger>
          <TabsTrigger value="routines">{t("tasks.studyRoutines")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "routines" ? (
        routines.length === 0 ? (
          <EmptyState title={t("tasks.studyRoutines")} />
        ) : (
          <ul className="space-y-2.5">
            {routines.map((r) => {
              const subject = subjects?.find((s) => s.id === r.subjectId);
              return (
              <li
                key={r.id}
                className="paper-card p-3.5 flex flex-col gap-3 border-l-4"
                style={subjectBorderStyle(subject?.color, subject?.type, subject?.customColor)}
              >
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 min-w-0 text-base font-medium leading-snug break-words">
                    {r.name ?? subjectName(r.subjectId)}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                        aria-label={t("common.actions")}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRegenerate(r)} disabled={regeneratingId === r.id}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${regeneratingId === r.id ? "animate-spin" : ""}`} />
                        {t("studyRoutine.regenerate")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/tasks/routines/edit/${r.id}`)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => r.id && setDelRoutineId(r.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                    {r.groups.length} {t("studyRoutine.groupsLabel", { count: r.groups.length })}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                    {summarizeRoutineDays(r.matrix)}
                  </span>
                </div>
              </li>
              );
            })}

          </ul>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="active">{t("tasks.active")}</SelectItem>
                <SelectItem value="done">{t("common.done")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("library.allSubjects")}</SelectItem>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder={t("tasks.searchByTitle")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />

          {tasks === undefined ? (
            <ListSkeleton />
          ) : pageItems.length === 0 ? (
            <EmptyState title={t("tasks.noTasks")} />
          ) : (
            <ul className="space-y-2.5">
              {pageItems.map((task) => {
                const subject = subjects?.find((s) => s.id === task.subjectId);
                return (
                <li
                  key={task.id}
                  className={`paper-card p-3.5 flex flex-col gap-3 border-l-4 ${task.done ? "opacity-70" : ""}`}
                  style={subjectBorderStyle(subject?.color, subject?.type, subject?.customColor)}
                >
                  <div className="flex items-start gap-2">
                    <h3 className={`flex-1 min-w-0 text-base font-medium leading-snug break-words ${task.done ? "line-through" : ""}`}>
                      {task.title}
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-8 w-8 -mt-1 -mr-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                          aria-label={t("common.more")}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/tasks/edit/${task.id}`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => askDelete(task)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                    {task.recurrence && (
                      <>
                        <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                          {t("tasks.fromDate", { date: formatDate(task.date, lang) })}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                          {summarizeRecurrence(task.recurrence, t, lang)}
                        </span>
                      </>
                    )}
                    {task.targetBpm && (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                        {task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩"}={task.targetBpm}
                      </span>
                    )}
                  </div>
                </li>
                );
              })}

            </ul>
          )}

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}



      {tasks !== undefined && (
        <section className="space-y-2 pt-2">
          <div className="flex items-center gap-2 px-1">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex-1">
              {t("tasks.upcomingSchedule")}
            </h3>
          </div>
          <TaskCalendarView subjects={subjects ?? []} />
        </section>
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
