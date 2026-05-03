import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LibraryKind } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BookOpen, Music2, Activity, Brain, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const KINDS: { key: LibraryKind; icon: typeof BookOpen; tKey: string }[] = [
  { key: "repertoire", icon: Music2, tKey: "library.kind.repertoire" },
  { key: "manual",     icon: BookOpen, tKey: "library.kind.manual" },
  { key: "technique",  icon: Activity, tKey: "library.kind.technique" },
  { key: "theory",     icon: Brain, tKey: "library.kind.theory" },
];

export default function Library() {
  const { t } = useI18n();
  const [active, setActive] = useState<LibraryKind>("repertoire");
  const items = useLiveQuery(() => db.library.where("kind").equals(active).toArray(), [active]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("nav.library")}</h2>
        <Button size="sm" variant="ghost"><Plus className="h-4 w-4 mr-1" /> {t("library.add")}</Button>
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
        <div className="paper-card p-10 text-center">
          <p className="text-muted-foreground italic">{t("library.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="paper-card p-4">
              <div className="font-serif text-xl">{it.title}</div>
              {it.composer && <div className="text-sm text-muted-foreground italic">{it.composer}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
