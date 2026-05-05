import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface Props {
  label?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  max?: number;
}

export function StarRating({ label, value, onChange, max = 5 }: Props) {
  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => {
          const n = i + 1;
          const active = value !== undefined && n <= value;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => onChange(n)}
              className="p-1 transition-transform hover:-translate-y-0.5"
            >
              <Star
                className={cn(
                  "h-6 w-6",
                  active ? "fill-primary text-primary" : "text-muted-foreground/40"
                )}
              />
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Clear rating"
          onClick={() => onChange(undefined)}
          disabled={value === undefined}
          className={cn(
            "ml-2 p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors",
            value === undefined && "opacity-30 pointer-events-none"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
