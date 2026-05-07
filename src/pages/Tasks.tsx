import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteTaskPreservingHistory, type Task } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
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
import { ChevronLeft, ChevronRight, Pencil, Trash2, CheckCircle2, Circle, Repeat } from "lucide-react";
import { EditTaskSheet } from "@/components/diary/EditTaskSheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/shared/Loading";

const PAGE_SIZE = 5;
const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥", quarter: "♩", eighth: "♪", sixteenth: "𝅘𝅥𝅯",
};
const DAY_LBL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function summarizeRecurrence(rec: NonNullable<Task["recurrence"]>): string {
  const parts: string[] = [];
  if (rec.kind === "weekdays") {
    const days = (rec.days ?? []).map((d) => DAY_LBL[d]).join(", ");
    parts.push(days || "—");
  } else {
    parts.push(`every ${rec.everyXDays ?? 1}d`);
  }
  if (rec.endDate) parts.push(`until ${rec.endDate}`);
  else if (rec.occurrences) parts.push(`×${rec.occurrences}`);
  return parts.join(" · ");
}

export default function Tasks() {
  const { t } = useI18n();
  const tasks = useLiveQuery(() => db.tasks.filter((task) => !task.deletedAt).toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());

  const [view, setView] = useState<"occurrences" | "series">("occurrences");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Task | null>(null);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageIds = pageItems.map((task) => task.id!).filter(Boolean);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

  const toggleDone = async (task: Task) => {
    if (!task.id) return;
    await db.tasks.update(task.id, { done: !task.done });
  };

  const toggleSel = (id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
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

  const askDelete = (task: Task) => {
    setDelId(task.id ?? null);
    setDelMode(task.recurrence || task.recurrenceTaskId ? "one" : "one");
  };

  const confirmDelete = async () => {
    if (delId == null) return;
    const target = tasks?.find((task) => task.id === delId);
    if (!target) return;
    if (delMode === "series") {
      const seriesId = target.recurrence ? target.id : target.recurrenceTaskId;
      const ids: number[] = [];
      if (seriesId) {
        const children = (await db.tasks.where("recurrenceTaskId").equals(seriesId).primaryKeys()) as number[];
        ids.push(seriesId, ...children);
      } else {
        ids.push(delId);
      }
      let softCount = 0;
      for (const id of ids) {
        const mode = await deleteTaskPreservingHistory(id);
        if (mode === "soft") softCount++;
      }
      toast.success(softCount
        ? t("toast.seriesRemoved", { count: softCount })
        : t("toast.seriesDeleted"));
    } else {
      const mode = await deleteTaskPreservingHistory(delId);
      toast.success(mode === "soft" ? t("toast.taskArchived") : t("toast.taskDeleted"));
    }
    setDelId(null);
  };

  const bulkMarkDone = async (done: boolean) => {
    const ids = [...selected];
    if (!ids.length) return;
    await db.transaction("rw", db.tasks, async () => {
      for (const id of ids) await db.tasks.update(id, { done });
    });
    toast.success(done
      ? t("toast.tasksBulkDone", { count: ids.length })
      : t("toast.tasksBulkReopened", { count: ids.length }));
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    let soft = 0;
    for (const id of ids) {
      const m = await deleteTaskPreservingHistory(id);
      if (m === "soft") soft++;
    }
    toast.success(soft
      ? t("toast.tasksBulkDeleted", { count: ids.length, soft })
      : t("toast.tasksBulkDeletedClean", { count: ids.length }));
    setSelected(new Set());
    setBulkDel(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></Link>
        <h2 className="font-serif text-3xl flex-1">{t("tasks.allTasks")}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

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
              <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input placeholder={t("tasks.searchByTitle")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />

      {tasks === undefined ? (
        <ListSkeleton />
      ) : pageItems.length === 0 ? (
        <p className="paper-card p-6 text-center text-muted-foreground italic">{t("tasks.noTasks")}</p>
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
                      ? <>{t("tasks.fromDate", { date: task.date })} · {summarizeRecurrence(task.recurrence)} · {subjectName(task.subjectId)}</>
                      : <>{task.date} · {subjectName(task.subjectId)}</>}
                    {task.targetBpm && <> · {task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩"}={task.targetBpm}</>}
                  </div>
                </div>
                <button onClick={() => setEditing(task)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <EditTaskSheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} task={editing} />

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
