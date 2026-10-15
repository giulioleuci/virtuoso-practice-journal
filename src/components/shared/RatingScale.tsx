import { cn } from "@/lib/utils";

/** Five numbered choices for one 1-5 rating; the chosen label (or "not answered") is spelled out, so state never relies on colour. */
export function RatingScale({ label, question, labels, value, onChange, unanswered, required = false }: {
  label: string;
  question: string;
  /** Five labels; index 0 is value 1. */
  labels: string[];
  value: number | undefined;
  onChange: (value: number) => void;
  unanswered: string;
  required?: boolean;
}) {
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-xs font-medium text-foreground">{label}</legend>
      <p className="text-xs text-muted-foreground">{question}</p>
      <div role="group" aria-label={label} className="grid grid-cols-5 gap-1.5">
        {labels.map((text, i) => {
          const n = i + 1;
          return (
            <button key={n} type="button" aria-pressed={value === n} aria-label={`${n} — ${text}`} onClick={() => onChange(n)}
              className={cn("min-h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors", value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/40")}>
              {n}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={cn("text-xs", value === undefined && required ? "font-medium text-destructive" : "text-muted-foreground")}>
        {value === undefined ? unanswered : labels[value - 1]}
      </p>
    </fieldset>
  );
}
