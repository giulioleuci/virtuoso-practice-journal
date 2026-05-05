import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());

  const [view, setView] = useState<"occurrences" | "series">("occurrences");
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Task | null>(null);
  const [delId, setDelId] = useState<number | null>(null);
  const [delMode, setDelMode] = useState<"one" | "series">("one");

  const filtered = useMemo(() => {
    let arr = tasks ?? [];
    if (view === "series") {
      arr = arr.filter((t) => !!t.recurrence);
    }
    if (filter === "active") arr = arr.filter((t) => !t.done);
    if (filter === "done") arr = arr.filter((t) => t.done);
    if (subjectFilter !== "all") arr = arr.filter((t) => t.subjectId === Number(subjectFilter));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((t) => t.title.toLowerCase().includes(needle));
    }
    return [...arr].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    });
  }, [tasks, view, filter, subjectFilter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

  const toggleDone = async (t: Task) => {
    if (!t.id) return;
    await db.tasks.update(t.id, { done: !t.done });
  };

  const askDelete = (t: Task) => {
    setDelId(t.id ?? null);
    setDelMode(t.recurrence || t.recurrenceTaskId ? "one" : "one");
  };

  const confirmDelete = async () => {
    if (delId == null) return;
    const target = tasks?.find((t) => t.id === delId);
    if (!target) return;
    if (delMode === "series") {
      const seriesId = target.recurrence ? target.id : target.recurrenceTaskId;
      await db.transaction("rw", db.tasks, async () => {
        if (seriesId) {
          await db.tasks.where("recurrenceTaskId").equals(seriesId).delete();
          await db.tasks.delete(seriesId);
        } else {
          await db.tasks.delete(delId);
        }
      });
      toast.success("Series deleted");
    } else {
      await db.tasks.delete(delId);
      toast.success("Task deleted");
    }
    setDelId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></Link>
        <h2 className="font-serif text-3xl flex-1">All tasks</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {(subjects ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Search by title…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />

      {pageItems.length === 0 ? (
        <p className="paper-card p-6 text-center text-muted-foreground italic">No tasks.</p>
      ) : (
        <ul className="space-y-2">
          {pageItems.map((t) => (
            <li key={t.id} className="paper-card p-3 flex items-start gap-2">
              <button onClick={() => toggleDone(t)} className="mt-0.5 shrink-0">
                {t.done
                  ? <CheckCircle2 className="h-5 w-5 text-primary" />
                  : <Circle className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`font-medium truncate ${t.done ? "line-through opacity-70" : ""}`}>{t.title}</span>
                  {(t.recurrence || t.recurrenceTaskId) && (
                    <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {t.date} · {subjectName(t.subjectId)}
                  {t.targetBpm && <> · {t.noteVal ? NOTE_GLYPH[t.noteVal] : "♩"}={t.targetBpm}</>}
                </div>
              </div>
              <button onClick={() => setEditing(t)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => askDelete(t)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
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
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const t = tasks?.find((x) => x.id === delId);
                if (!t) return null;
                if (t.recurrence || t.recurrenceTaskId) {
                  return (
                    <span className="block space-y-2">
                      <span>Part of a recurring series.</span>
                      <span className="flex gap-2 mt-2">
                        <button
                          onClick={() => setDelMode("one")}
                          className={`text-xs px-3 py-1 rounded-full border ${delMode === "one" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                        >Just this one</button>
                        <button
                          onClick={() => setDelMode("series")}
                          className={`text-xs px-3 py-1 rounded-full border ${delMode === "series" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                        >Entire series</button>
                      </span>
                    </span>
                  );
                }
                return "This cannot be undone.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
