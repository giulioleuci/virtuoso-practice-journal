import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Five stars for one 1-5 rating. The meaning of the chosen star (or the scale, before any choice) is spelled out,
 * so state never relies on colour. A visible button clears the choice, for a slip of the finger or a change of mind.
 */
export function RatingScale({ label, question, labels, value, onChange, unanswered, scaleHint, clearLabel, required = false }: {
  label: string;
  question: string;
  /** Five labels; index 0 is value 1. */
  labels: string[];
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unanswered: string;
  /** Spells out both ends of the scale, e.g. "1 = Very low · 5 = Very high". */
  scaleHint: string;
  /** Accessible start of the button that clears the choice; the scale's label is appended. */
  clearLabel: string;
  required?: boolean;
}) {
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-xs font-medium text-foreground">{label}</legend>
      <p className="text-xs text-muted-foreground">{question}</p>
      <div role="group" aria-label={label} className="flex gap-1">
        {labels.map((text, i) => {
          const n = i + 1;
          return (
            <button key={n} type="button" aria-pressed={value === n} aria-label={`${n} — ${text}`} onClick={() => onChange(n)}
              className={cn("grid h-11 w-11 place-items-center rounded-md transition-colors hover:bg-secondary/40", value !== undefined && n <= value ? "text-primary" : "text-muted-foreground")}>
              <Star className={cn("h-6 w-6", value !== undefined && n <= value && "fill-current")} aria-hidden />
            </button>
          );
        })}
      </div>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <p aria-live="polite" className={cn("text-xs", value === undefined && required ? "font-medium text-destructive" : "text-muted-foreground")}>
          {value === undefined ? `${required ? `${unanswered} · ` : ""}${scaleHint}` : labels[value - 1]}
        </p>
        {value !== undefined && (
          <button type="button" aria-label={`${clearLabel}: ${label}`} onClick={() => onChange(undefined)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
            <X className="h-3.5 w-3.5" aria-hidden />{clearLabel}
          </button>
        )}
      </div>
    </fieldset>
  );
}
