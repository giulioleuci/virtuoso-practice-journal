import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { firstTempo } from "@/domain/logic/plan";
import type { Task } from "@/domain/entities/task";
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

/**
 * Shows a BPM suggestion chip when the user has nailed the same BPM
 * with quality ≥ "well" and confidence ≥ 4 for the last 3 sessions.
 */
export function BpmSuggestion({ task, onAccept, dismissed, onDismiss }: Props) {
  const { t } = useI18n();
  const todayKey = today();

  const suggestion = usePresentationRead<{ reached: number; next: number } | null>("sessions.bpmSuggestion", [task.itemId, todayKey, firstTempo(task.plan)?.noteVal ?? "quarter"]);

  if (!suggestion || dismissed) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
      "bg-primary/10 border border-primary/20"
    )}>
      <SuggestionIcon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="flex-1 text-primary">
        {t("session.bpmSuggestionTitle", { bpm: suggestion.reached })}
      </span>
      <button
        type="button"
        onClick={() => onAccept(suggestion.next)}
        className="font-semibold text-primary hover:text-primary/80 shrink-0"
      >
        {t("session.bpmSuggestion", { bpm: suggestion.next })}
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
