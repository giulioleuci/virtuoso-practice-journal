import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Plus, CheckCircle2, Circle, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NewTaskSheet } from "@/components/diary/NewTaskSheet";
import { SessionLogSheet } from "@/components/diary/SessionLogSheet";
import { StatsDashboard } from "@/components/diary/StatsDashboard";
import { pickQuote } from "@/lib/quotes";
import { cn } from "@/lib/utils";

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
  const tasks = useLiveQuery(() => db.tasks.where("date").equals(today).toArray(), [today]);
  const allSessions = useLiveQuery(() => db.sessions.toArray(), []);
  const sessionsByTask = (allSessions ?? []).reduce<Record<number, typeof allSessions>>((acc, s) => {
    (acc[s.taskId] ||= [] as never).push(s as never);
    return acc;
  }, {});

  const [newOpen, setNewOpen] = useState(false);
  const [logTask, setLogTask] = useState<Task | null>(null);

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

      <StatsDashboard />

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
                  <button
                    onClick={() => setLogTask(task)}
                    className={cn(
                      "paper-card p-4 w-full text-left flex items-start gap-3 transition-all hover:-translate-y-0.5",
                      task.done && "opacity-70"
                    )}
                  >
                    {task.done ? (
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
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
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground self-center">
                      {task.done ? "Log again" : "Log"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <NewTaskSheet open={newOpen} onOpenChange={setNewOpen} date={today} />
      <SessionLogSheet open={logTask !== null} onOpenChange={(o) => !o && setLogTask(null)} task={logTask} />
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
