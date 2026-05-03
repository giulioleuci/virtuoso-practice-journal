import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Flame, Sparkles } from "lucide-react";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Diary() {
  const { t } = useI18n();
  const profile = useLiveQuery(() => db.profile.get("me"));
  const today = todayKey();
  const tasks = useLiveQuery(() => db.tasks.where("date").equals(today).toArray(), [today]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{t("diary.today")}</p>
        <h2 className="font-serif text-3xl">Hello, {profile?.name ?? "Musician"}</h2>
        <p className="text-muted-foreground italic mt-1">{dateLabel}</p>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/60">
          <Stat icon={Flame} label="Streak" value="0d" />
          <Stat icon={Sparkles} label="Today" value={`${tasks?.filter((x)=>x.done).length ?? 0}/${tasks?.length ?? 0}`} />
          <Stat label="This week" value="0 min" />
        </div>
      </section>

      <section>
        <h3 className="font-serif text-2xl mb-3">{t("diary.today")}</h3>
        {!tasks?.length ? (
          <div className="paper-card p-8 text-center">
            <p className="text-muted-foreground italic">{t("diary.empty")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="paper-card p-4 flex items-center gap-3">
                <input type="checkbox" defaultChecked={task.done} className="h-5 w-5 accent-primary" />
                <div className="flex-1">
                  <div className="font-medium">{task.title}</div>
                  {task.targetBpm && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Target {task.targetBpm} {task.noteVal}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
