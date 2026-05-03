import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Lessons() {
  const { t } = useI18n();
  const recurrences = useLiveQuery(() => db.recurrences.toArray());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">{t("nav.lessons")}</h2>
        <Button size="sm" variant="ghost"><Plus className="h-4 w-4 mr-1" /> {t("lessons.addRecurrence")}</Button>
      </div>

      {!recurrences?.length ? (
        <div className="paper-card p-10 text-center">
          <p className="text-muted-foreground italic">{t("lessons.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recurrences.map((r) => (
            <li key={r.id} className="paper-card p-4 flex items-center gap-3">
              <span className={`h-10 w-1.5 rounded-full bg-key-${r.color}`} />
              <div className="flex-1">
                <div className="font-serif text-xl">{r.teacher}</div>
                <div className="text-sm text-muted-foreground">{r.frequency} • {r.startTime}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
