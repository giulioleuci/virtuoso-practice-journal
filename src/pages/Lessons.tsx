import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Assignment, type Lesson, type LessonRecurrence } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, NotebookPen, Wand2, CheckCircle2 } from "lucide-react";
import { RecurrenceSheet } from "@/components/lessons/RecurrenceSheet";
import { LessonLogSheet } from "@/components/lessons/LessonLogSheet";
import { NewTaskSheet } from "@/components/diary/NewTaskSheet";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function Lessons() {
  const { t } = useI18n();
  const recurrences = useLiveQuery(() => db.recurrences.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());
  const lessons = useLiveQuery(() => db.lessons.orderBy("date").reverse().limit(20).toArray());
  const assignments = useLiveQuery(() => db.assignments.toArray());

  const [recOpen, setRecOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<LessonRecurrence | null>(null);
  const [delRecId, setDelRecId] = useState<number | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logRec, setLogRec] = useState<LessonRecurrence | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [delLessonId, setDelLessonId] = useState<number | null>(null);

  const [taskPrefill, setTaskPrefill] = useState<{ subjectId?: number; title?: string; assignmentId?: number } | null>(null);

  const openNew = () => { setEditingRec(null); setRecOpen(true); };
  const openEdit = (r: LessonRecurrence) => { setEditingRec(r); setRecOpen(true); };

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

  const openLog = (r: LessonRecurrence) => {
    setLogRec(r);
    setEditingLesson(null);
    setLogOpen(true);
  };
  const openEditLesson = (l: Lesson) => {
    setEditingLesson(l);
    setLogRec(recurrences?.find((r) => r.id === l.recurrenceId) ?? null);
    setLogOpen(true);
  };

  const deleteRec = async () => {
    if (delRecId == null) return;
    await db.recurrences.delete(delRecId);
    toast.success("Removed");
    setDelRecId(null);
  };
  const deleteLesson = async () => {
    if (delLessonId == null) return;
    await db.transaction("rw", db.lessons, db.assignments, async () => {
      await db.assignments.where("lessonId").equals(delLessonId).delete();
      await db.lessons.delete(delLessonId);
    });
    toast.success("Lesson deleted");
    setDelLessonId(null);
  };

  const pendingAssignments = (assignments ?? []).filter((a) => !a.transformed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("nav.lessons")}</h2>
        <Button size="sm" variant="ghost" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> {t("lessons.addRecurrence")}
        </Button>
      </div>

      {/* Recurrences */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Teachers</h3>
        {!recurrences?.length ? (
          <button onClick={openNew} className="paper-card p-8 text-center w-full hover:-translate-y-0.5 transition-transform">
            <p className="text-muted-foreground italic mb-2">{t("lessons.empty")}</p>
            <span className="inline-flex items-center gap-1 text-primary font-medium text-sm">
              <Plus className="h-4 w-4" /> {t("lessons.addRecurrence")}
            </span>
          </button>
        ) : (
          <ul className="space-y-2">
            {recurrences.map((r) => (
              <li key={r.id} className="paper-card p-4 flex items-center gap-3">
                <span className="h-12 w-1.5 rounded-full" style={{ backgroundColor: `hsl(var(--key-${r.color}))` }} />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-xl truncate">{r.teacher}</div>
                  <div className="text-xs text-muted-foreground">
                    {subjectName(r.subjectId)} · {r.frequency} · {DAYS[r.dayOfWeek]} {r.startTime}–{r.endTime}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openLog(r)}>
                  <NotebookPen className="h-4 w-4 mr-1" /> Log
                </Button>
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => r.id && setDelRecId(r.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending assignments */}
      {pendingAssignments.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Assignments to schedule</h3>
          <ul className="space-y-2">
            {pendingAssignments.map((a) => {
              const lesson = lessons?.find((l) => l.id === a.lessonId);
              return (
                <li key={a.id} className="paper-card p-3 flex items-center gap-3">
                  <Wand2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 text-sm">{a.text}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setTaskPrefill({
                        subjectId: lesson?.subjectId,
                        title: a.text,
                        assignmentId: a.id,
                      })
                    }
                  >
                    Make task
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Recent lessons */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Recent lessons</h3>
        {!lessons?.length ? (
          <p className="paper-card p-6 text-center text-muted-foreground italic">No lessons logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((l) => {
              const las = (assignments ?? []).filter((a) => a.lessonId === l.id);
              return (
                <li key={l.id} className="paper-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-lg">{subjectName(l.subjectId)}</div>
                      <div className="text-xs text-muted-foreground">{l.date}</div>
                      {l.notes && <p className="text-sm mt-1 line-clamp-2">{l.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditLesson(l)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => l.id && setDelLessonId(l.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {las.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                      {las.length} assignment{las.length === 1 ? "" : "s"} ·{" "}
                      <span className="text-primary inline-flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        {las.filter((a) => a.transformed).length} scheduled
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RecurrenceSheet
        open={recOpen}
        onOpenChange={(o) => { setRecOpen(o); if (!o) setEditingRec(null); }}
        recurrence={editingRec}
      />

      <LessonLogSheet
        open={logOpen}
        onOpenChange={(o) => { setLogOpen(o); if (!o) { setEditingLesson(null); setLogRec(null); } }}
        recurrence={logRec}
        lesson={editingLesson}
      />

      <NewTaskSheet
        open={taskPrefill !== null}
        onOpenChange={(o) => !o && setTaskPrefill(null)}
        date={todayKey()}
        prefill={taskPrefill ?? undefined}
      />

      <AlertDialog open={delRecId !== null} onOpenChange={(o) => !o && setDelRecId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this teacher?</AlertDialogTitle>
            <AlertDialogDescription>Logged lessons are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRec} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delLessonId !== null} onOpenChange={(o) => !o && setDelLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
            <AlertDialogDescription>Its assignments will be removed too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLesson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Touch unused import warning
type _A = Assignment;
