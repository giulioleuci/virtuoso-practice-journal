import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BookOpen, Music2, Activity, Brain, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewLibraryItemSheet } from "@/components/library/NewLibraryItemSheet";

const KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory" },
];

export default function Library() {
  const { t } = useI18n();
  const [active, setActive] = useState<LibraryKind>("repertoire");
  const [sheetOpen, setSheetOpen] = useState(false);
  const items = useLiveQuery(() => db.library.where("kind").equals(active).toArray(), [active]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("nav.library")}</h2>
        <Button size="sm" variant="ghost" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> {t("library.add")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {KINDS.map(({ key, icon: Icon, tKey }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={cn(
              "paper-card flex flex-col items-center gap-1 py-3 transition-all",
              active === key ? "ring-2 ring-primary -translate-y-0.5" : "hover:-translate-y-0.5"
            )}
          >
            <Icon className={cn("h-5 w-5", active === key ? "text-primary" : "text-muted-foreground")} />
            <span className="text-[11px] font-medium leading-tight text-center">{t(tKey)}</span>
          </button>
        ))}
      </div>

      {!items?.length ? (
        <button
          onClick={() => setSheetOpen(true)}
          className="paper-card p-10 text-center w-full hover:-translate-y-0.5 transition-transform"
        >
          <p className="text-muted-foreground italic mb-2">{t("library.empty")}</p>
          <span className="inline-flex items-center gap-1 text-primary font-medium text-sm">
            <Plus className="h-4 w-4" /> {t("library.add")}
          </span>
        </button>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="paper-card p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-serif text-xl">{it.title}</div>
                  {it.composer && (
                    <div className="text-sm text-muted-foreground italic">{it.composer}</div>
                  )}
                </div>
                {it.targetBpm && (
                  <div className="text-sm font-serif tabular-nums text-primary">
                    ♩ = {it.targetBpm}
                  </div>
                )}
              </div>
              {it.kind === "manual" && it.totalExercises && (
                <div className="text-xs text-muted-foreground mt-1">
                  Exercise {it.currentExercise ?? 1} / {it.totalExercises}
                </div>
              )}
              {it.kind === "theory" && it.mastery && (
                <div className="grid grid-cols-4 gap-2 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {(["conceptual","analytical","aural","compositional"] as const).map((k) => (
                    <div key={k}>
                      <div>{k.slice(0,4)}</div>
                      <div className="text-foreground font-serif text-base">{it.mastery![k]}</div>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <NewLibraryItemSheet open={sheetOpen} onOpenChange={setSheetOpen} kind={active} />
    </div>
  );
}
