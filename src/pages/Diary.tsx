import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task, type Session } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Plus, CheckCircle2, Circle, ListChecks, Play, ArrowRightCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NewTaskSheet } from "@/components/diary/NewTaskSheet";
import { SessionLogSheet } from "@/components/diary/SessionLogSheet";
import { SessionDetailSheet } from "@/components/diary/SessionDetailSheet";
import { PracticeMode } from "@/components/diary/PracticeMode";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { pickQuote } from "@/lib/quotes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const NOTE_GLYPH: Record<string, string> = {
  half: "𝅗𝅥", quarter: "♩", eighth: "♪", sixteenth: "𝅘𝅥𝅯",
};

export default function Diary() {
  const { t } = useI18n();
  const profile = useLiveQuery(() => db.profile.get("me"));
  const today = todayKey();
  const tasks = useLiveQuery(() => db.tasks.where("date").equals(today).filter((t) => !t.deletedAt).toArray(), [today]);
  const allSessions = useLiveQuery(() => db.sessions.toArray(), []);
  const sessionsByTask = (allSessions ?? []).reduce<Record<number, typeof allSessions>>((acc, s) => {
    (acc[s.taskId] ||= [] as never).push(s as never);
    return acc;
  }, {});

  const carryoverDays = profile?.carryoverDays ?? 2;
  const carryoverFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - carryoverDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [carryoverDays]);

  const carryoverTasks = useLiveQuery(
    () => db.tasks
      .where("date").between(carryoverFrom, today, true, false)
      .filter((t) => !t.done && !t.skipped)
      .toArray(),
    [carryoverFrom, today]
  );

  const [newOpen, setNewOpen] = useState(false);
  const [logTask, setLogTask] = useState<Task | null>(null);
  const [logPrefill, setLogPrefill] = useState<{ bpm?: number; noteVal?: import("@/lib/db").NoteVal; notes?: string } | undefined>();
  const [practiceTask, setPracticeTask] = useState<Task | null>(null);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [confirmUncomplete, setConfirmUncomplete] = useState<Task | null>(null);
  const [carryPage, setCarryPage] = useState(0);
  const CARRY_PAGE_SIZE = 4;

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  const doneCount = tasks?.filter((x) => x.done).length ?? 0;

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{t("diary.today")}</p>
        <h2 className="font-serif text-3xl">Hello, {profile?.name ?? "Musician"}</h2>
        <p className="text-muted-foreground italic mt-1">{dateLabel}</p>
        <p className="text-sm text-muted-foreground tabular-nums mt-3">{doneCount}/{tasks?.length ?? 0} done today</p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-2xl">{t("diary.today")}</h3>
          <div className="flex items-center gap-1">
            <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1">
              <ListChecks className="h-4 w-4" /> All
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New task
            </Button>
          </div>
        </div>

        {!tasks?.length ? (
          <EmptyDiary onAdd={() => setNewOpen(true)} hint={t("diary.empty")} />
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => {
              const sess = (task.id && sessionsByTask[task.id]) || [];
              const last = sess[sess.length - 1];
              return (
                <li key={task.id}>
                  <div
                    className={cn(
                      "paper-card p-4 w-full flex items-start gap-3 transition-all hover:-translate-y-0.5",
                      task.done && "opacity-70"
                    )}
                  >
                    <button
                      onClick={() => task.done && setConfirmUncomplete(task)}
                      className="mt-0.5 shrink-0"
                      aria-label={task.done ? "Mark as not done" : "Pending"}
                      disabled={!task.done}
                    >
                      {task.done ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (task.done && last) {
                          setDetailSession(last as Session);
                        } else {
                          setLogPrefill(undefined);
                          setLogTask(task);
                        }
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className={cn("font-medium", task.done && "line-through")}>{task.title}</div>
                      {task.targetBpm && (
                        <div className="text-xs text-muted-foreground tabular-nums">
                          Target {task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩"} = {task.targetBpm}
                        </div>
                      )}
                      {last && (
                        <div className="text-xs text-primary tabular-nums mt-0.5 inline-flex items-center gap-1">
                          {last.bpmReached && (
                            <>{last.noteVal ? NOTE_GLYPH[last.noteVal] : "♩"} = {last.bpmReached} ·</>
                          )}
                          {last.quality}
                        </div>
                      )}
                    </button>
                    {!task.done && (
                      <button
                        onClick={() => setPracticeTask(task)}
                        className="self-center inline-flex items-center gap-1 text-xs uppercase tracking-wider px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                        aria-label="Start practice"
                      >
                        <Play className="h-3.5 w-3.5" /> Start
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-2xl">Unfinished</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              from last {carryoverDays} day{carryoverDays === 1 ? "" : "s"}
            </span>
          </div>
          {(() => {
            const total = carryoverTasks.length;
            const totalPages = Math.max(1, Math.ceil(total / CARRY_PAGE_SIZE));
            const page = Math.min(carryPage, totalPages - 1);
            const slice = carryoverTasks.slice(page * CARRY_PAGE_SIZE, page * CARRY_PAGE_SIZE + CARRY_PAGE_SIZE);
            return (
              <>
                <ul className="space-y-2">
                  {slice.map((task) => (
                    <li key={task.id}>
                      <div className="paper-card p-4 w-full flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{task.title}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {task.date}
                            {task.targetBpm && (
                              <> · Target {task.noteVal ? NOTE_GLYPH[task.noteVal] : "♩"} = {task.targetBpm}</>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!task.id) return;
                            const { id, date, done, skipped, ...rest } = task;
                            await db.tasks.add({ ...rest, date: today, done: false, createdAt: Date.now() });
                            await db.tasks.update(id, { skipped: true });
                            toast.success("Moved to today");
                          }}
                          className="self-center inline-flex items-center gap-1 text-xs uppercase tracking-wider px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                          aria-label="Move to today"
                        >
                          <ArrowRightCircle className="h-3.5 w-3.5" /> Today
                        </button>
                        <button
                          onClick={async () => {
                            if (!task.id) return;
                            await db.tasks.update(task.id, { skipped: true });
                            toast("Ignored");
                          }}
                          className="self-center p-2 rounded-xl text-muted-foreground hover:text-destructive shrink-0"
                          aria-label="Ignore"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
                    <Button size="icon" variant="ghost" disabled={page === 0} onClick={() => setCarryPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="tabular-nums">{page + 1} / {totalPages}</span>
                    <Button size="icon" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setCarryPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      <NewTaskSheet open={newOpen} onOpenChange={setNewOpen} date={today} />
      <SessionLogSheet
        open={logTask !== null}
        onOpenChange={(o) => { if (!o) { setLogTask(null); setLogPrefill(undefined); } }}
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
              notes: mins > 0 ? `Practiced ${mins} min` : undefined,
            });
            setLogTask(practiceTask);
            setPracticeTask(null);
          }}
        />
      )}
      <SessionDetailSheet
        open={detailSession !== null}
        onOpenChange={(o) => { if (!o) setDetailSession(null); }}
        session={detailSession}
      />
      <AlertDialog open={confirmUncomplete !== null} onOpenChange={(o) => { if (!o) setConfirmUncomplete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as not done?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reopen the task and delete all sessions logged for it today. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const t = confirmUncomplete;
                if (!t?.id) return;
                const sessions = await db.sessions.where("taskId").equals(t.id).and((s) => s.date === t.date).toArray();
                await db.sessions.bulkDelete(sessions.map((s) => s.id!).filter(Boolean) as number[]);
                await db.tasks.update(t.id, { done: false });
                toast.success("Task reopened");
                setConfirmUncomplete(null);
              }}
            >
              Reopen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyDiary({ onAdd, hint }: { onAdd: () => void; hint: string }) {
  const quote = useMemo(() => pickQuote(), []);
  return (
    <button
      onClick={onAdd}
      className="paper-card p-8 text-center w-full hover:-translate-y-0.5 transition-transform group"
    >
      <p className="font-serif text-xl italic text-foreground/85 leading-snug">
        “{quote.text}”
      </p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
        — {quote.author}
      </p>
      <p className="text-sm text-muted-foreground italic mt-4">{hint}</p>
      <span className="inline-flex items-center gap-1 text-primary font-medium text-sm mt-3 group-hover:gap-2 transition-all">
        <Plus className="h-4 w-4" /> Begin a task
      </span>
    </button>
  );
}
