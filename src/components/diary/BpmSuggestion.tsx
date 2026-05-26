import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { today } from "@/lib/date";
import { SuggestionIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  onAccept: (bpm: number) => void;
  dismissed: boolean;
  onDismiss: () => void;
}

const INCREMENT_STEPS = [2, 3, 4, 5, 8, 10];

function nextBpmStep(bpm: number): number {
  for (const step of INCREMENT_STEPS) {
    if (bpm % step === 0) return bpm + step;
  }
  return bpm + 5;
}

/**
 * Shows a BPM suggestion chip when the user has nailed the same BPM
 * with quality ≥ "well" and confidence ≥ 4 for the last 3 sessions.
 */
export function BpmSuggestion({ task, onAccept, dismissed, onDismiss }: Props) {
  const { t } = useI18n();
  const todayKey = today();

  const suggestion = useLiveQuery(async (): Promise<number | null> => {
    if (!task.itemId) return null;

    const relatedTasks = await db.tasks.where("itemId").equals(task.itemId).toArray();
    const ids = relatedTasks.map((x) => x.id!).filter(Boolean);
    if (!ids.length) return null;

    const sessions = await db.sessions
      .where("taskId")
      .anyOf(ids)
      .and((s) => s.date < todayKey && !!s.bpmReached)
      .sortBy("date");

    if (sessions.length < 3) return null;

    const last3 = sessions.slice(-3);
    const bpm = last3[0].bpmReached!;

    const consistent = last3.every(
      (s) =>
        s.bpmReached === bpm &&
        (s.quality === "well" || s.quality === "great") &&
        (s.confidence ?? 0) >= 4
    );

    if (!consistent) return null;
    return nextBpmStep(bpm);
  }, [task.itemId, todayKey]);

  if (!suggestion || dismissed) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
      "bg-primary/10 border border-primary/20"
    )}>
      <SuggestionIcon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="flex-1 text-primary">
        {t("session.bpmSuggestionTitle", { bpm: suggestion - (suggestion - nextBpmStep(suggestion - 5)) })}
      </span>
      <button
        type="button"
        onClick={() => onAccept(suggestion)}
        className="font-semibold text-primary hover:text-primary/80 shrink-0"
      >
        {t("session.bpmSuggestion", { bpm: suggestion })}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground ml-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
