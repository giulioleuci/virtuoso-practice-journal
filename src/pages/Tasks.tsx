import { useMemo, useState } from "react";
import { type Task, type StudyRoutine } from "@/lib/db";
import { useActiveTasks, useStudyRoutines, useSubjects } from "@/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import type { Lang } from "@/lib/db";
import { studyRoutinesService, tasksService, deleteWithUndo } from "@/lib/services";
import { NOTE_GLYPH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Pencil, Trash2, CheckCircle2, Circle, Repeat, CalendarClock, RefreshCw, CalendarRange } from "lucide-react";

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

  const [view, setView] = useState<"occurrences" | "series">("occurrences");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const [delRoutineId, setDelRoutineId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [delId, setDelId] = useState<number | null>(null);
  const [delMode, setDelMode] = useState<"one" | "series">("one");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDel, setBulkDel] = useState(false);

  const filtered = useMemo(() => {
    let arr = tasks ?? [];
    if (view === "series") {
      arr = arr.filter((task) => !!task.recurrence);
    }
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
  }, [tasks, view, filter, subjectFilter, q]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);
  const pageIds = pageItems.map((task) => task.id).filter(Boolean);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

  const toggleDone = async (task: Task) => {
    if (!task.id) return;
    await tasksService.toggleDone(task.id, !task.done);
  };

  const toggleSel = (id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  };

  const togglePage = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelectedOnPage) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  };

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

  const bulkMarkDone = async (done: boolean) => {
    const ids = [...selected];
    if (!ids.length) return;
    await tasksService.bulkSetDone(ids, done);
    toast.success(done
      ? t("toast.tasksBulkDone", { count: ids.length })
      : t("toast.tasksBulkReopened", { count: ids.length }));
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const { soft } = await tasksService.bulkRemove(ids);
    toast.success(soft
      ? t("toast.tasksBulkDeleted", { count: ids.length, soft })
      : t("toast.tasksBulkDeletedClean", { count: ids.length }));
    setSelected(new Set());
    setBulkDel(false);
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
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

      {routines.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex-1">
              {t("tasks.studyRoutines")}
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">{routines.length}</span>
          </div>
          <ul className="space-y-2">
            {routines.map((r) => (
              <li key={r.id} className="paper-card p-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {r.name ?? subjectName(r.subjectId)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {subjectName(r.subjectId)} · {r.groups.length} {t("studyRoutine.groupsLabel", { count: r.groups.length })} · {summarizeRoutineDays(r.matrix)}
                  </div>
                </div>
                <button
                  onClick={() => handleRegenerate(r)}
                  disabled={regeneratingId === r.id}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
                  aria-label={t("studyRoutine.regenerate")}
                >
                  <RefreshCw className={`h-4 w-4 ${regeneratingId === r.id ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => navigate(`/tasks/routines/edit/${r.id}`)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label={t("common.edit")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => r.id && setDelRoutineId(r.id)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs value={view} onValueChange={(v) => { setView(v as typeof view); setPage(0); setSelected(new Set()); }}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="occurrences">{t("tasks.occurrences")}</TabsTrigger>
          <TabsTrigger value="series">{t("tasks.recurringSeries")}</TabsTrigger>
        </TabsList>
      </Tabs>

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
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Checkbox checked={allSelectedOnPage} onCheckedChange={togglePage} />
              <span>{selected.size > 0 ? t("common.selected", { count: selected.size }) : t("common.selectAll")}</span>
            </label>
            {selected.size > 0 && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => bulkMarkDone(true)}>{t("tasks.markDone")}</Button>
                <Button size="sm" variant="ghost" onClick={() => bulkMarkDone(false)}>{t("common.reopen")}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setBulkDel(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("common.delete")}
                </Button>
              </div>
            )}
          </div>
          <ul className="space-y-2">
            {pageItems.map((task) => (
              <li key={task.id} className="paper-card p-3 flex items-start gap-2">
                <Checkbox
                  className="mt-1 shrink-0"
                  checked={task.id ? selected.has(task.id) : false}
                  onCheckedChange={() => task.id && toggleSel(task.id)}
                  aria-label={t("common.select")}
                />
                <button onClick={() => toggleDone(task)} className="mt-0.5 shrink-0">
                  {task.done
                    ? <CheckCircle2 className="h-5 w-5 text-primary" />
                    : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-medium truncate ${task.done ? "line-through opacity-70" : ""}`}>{task.title}</span>
                    {(task.recurrence || task.recurrenceTaskId) && (
                      <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {view === "series" && task.recurrence
                      ? <>{t("tasks.fromDate", { date: task.date })} · {summarizeRecurrence(task.recurrence, t)} · {subjectName(task.subjectId)}</>
                      : <>{task.date} · {subjectName(task.subjectId)}</>}
                    {task.targetBpm && <> · {task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩"}={task.targetBpm}</>}
                  </div>
                </div>
                <button onClick={() => navigate(`/tasks/edit/${task.id}`)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => askDelete(task)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pager page={page} totalPages={totalPages} onChange={setPage} />

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

      <AlertDialog open={bulkDel} onOpenChange={setBulkDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.deleteTasksBulk", { count: selected.size })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.deleteTasksBulkDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
