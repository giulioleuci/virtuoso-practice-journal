import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Lesson, type LessonRecurrence } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, NotebookPen, Wand2, CheckCircle2, HelpCircle, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RecurrenceSheet } from "@/components/lessons/RecurrenceSheet";
import { LessonLogSheet } from "@/components/lessons/LessonLogSheet";
import { TeacherRecapSheet } from "@/components/lessons/TeacherRecapSheet";
import { NewTaskSheet } from "@/components/diary/NewTaskSheet";
import { upcomingLessonDates, dayKey } from "@/lib/recurrence";
import { toast } from "sonner";

const PAGE_SIZE = 5;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function Lessons() {
  const { t } = useI18n();
  const recurrences = useLiveQuery(() => db.recurrences.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());
  const lessons = useLiveQuery(() => db.lessons.orderBy("date").reverse().toArray());
  const assignments = useLiveQuery(() => db.assignments.toArray());
  const tasksAll = useLiveQuery(() => db.tasks.toArray());
  const openHelpCount = useLiveQuery(async () => (await db.helpRequests.toArray()).filter((h) => !h.resolved).length);

  const [recapOpen, setRecapOpen] = useState(false);

  const [recOpen, setRecOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<LessonRecurrence | null>(null);
  const [delRecId, setDelRecId] = useState<number | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logRec, setLogRec] = useState<LessonRecurrence | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [delLessonId, setDelLessonId] = useState<number | null>(null);

  const [taskPrefill, setTaskPrefill] = useState<{ subjectId?: number; title?: string; assignmentId?: number } | null>(null);
  const [logDate, setLogDate] = useState<string | undefined>();

  const [pageAssign, setPageAssign] = useState(0);
  const [pageUpcoming, setPageUpcoming] = useState(0);
  const [pageRecent, setPageRecent] = useState(0);

  const openNew = () => { setEditingRec(null); setRecOpen(true); };
  const openEdit = (r: LessonRecurrence) => { setEditingRec(r); setRecOpen(true); };

  const subjectName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? "—";

  const openLog = (r: LessonRecurrence, date?: string) => {
    setLogRec(r);
    setEditingLesson(null);
    setLogDate(date);
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

  // Auto-generated upcoming schedule from teacher recurrences
  const upcoming = useMemo(() => {
    const today = dayKey(new Date());
    const loggedDates = new Set(
      (lessons ?? []).map((l) => `${l.recurrenceId ?? "x"}:${l.date}`)
    );
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
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("nav.lessons")}</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setRecapOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-1" /> Recap
            {openHelpCount ? (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{openHelpCount}</span>
            ) : null}
          </Button>
          <Button size="sm" variant="ghost" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> {t("lessons.addRecurrence")}
          </Button>
        </div>
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

      {/* Upcoming schedule */}
      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming</h3>
          <ul className="space-y-2">
            {upcoming.map(({ rec, date, isToday }) => (
              <li key={`${rec.id}-${date}`} className="paper-card p-3 flex items-center gap-3">
                <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {rec.teacher} · {subjectName(rec.subjectId)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isToday ? "Today" : date} · {rec.startTime}–{rec.endTime}
                  </div>
                </div>
                <Button size="sm" variant={isToday ? "default" : "outline"} onClick={() => openLog(rec, date)}>
                  <NotebookPen className="h-4 w-4 mr-1" /> Log
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                                → {linkedTask?.title ?? "scheduled"}
                              </span>
                            ) : (
                              <button
                                onClick={() => setTaskPrefill({ subjectId: l.subjectId, title: a.text, assignmentId: a.id })}
                                className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                              >Make task</button>
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
        )}
      </section>

      <RecurrenceSheet
        open={recOpen}
        onOpenChange={(o) => { setRecOpen(o); if (!o) setEditingRec(null); }}
        recurrence={editingRec}
      />

      <LessonLogSheet
        open={logOpen}
        onOpenChange={(o) => { setLogOpen(o); if (!o) { setEditingLesson(null); setLogRec(null); setLogDate(undefined); } }}
        recurrence={logRec}
        lesson={editingLesson}
        prefilledDate={logDate}
      />

      <TeacherRecapSheet open={recapOpen} onOpenChange={setRecapOpen} />

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

