import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Flame, Sparkles, Plus, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewTaskSheet } from "@/components/diary/NewTaskSheet";
import { SessionLogSheet } from "@/components/diary/SessionLogSheet";
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

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/60">
          <Stat icon={Flame} label="Streak" value="0d" />
          <Stat icon={Sparkles} label="Today" value={`${doneCount}/${tasks?.length ?? 0}`} />
          <Stat label="This week" value={`${(allSessions ?? []).length}`} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-2xl">{t("diary.today")}</h3>
          <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New task
          </Button>
        </div>

        {!tasks?.length ? (
          <button
            onClick={() => setNewOpen(true)}
            className="paper-card p-8 text-center w-full hover:-translate-y-0.5 transition-transform"
          >
            <p className="text-muted-foreground italic mb-2">{t("diary.empty")}</p>
            <span className="inline-flex items-center gap-1 text-primary font-medium text-sm">
              <Plus className="h-4 w-4" /> New task
            </span>
          </button>
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

function Stat({ icon: Icon, label, value }: { icon?: typeof Flame; label: string; value: string }) {
  return (
    <div className="text-center">
      {Icon && <Icon className="h-4 w-4 text-primary mx-auto mb-1" />}
      <div className="font-serif text-2xl tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
