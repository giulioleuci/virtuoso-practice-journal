import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  label?: string;
  options: Option<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  emptyHint?: string;
}

export function MultiChipPicker<T extends string | number>({
  label, options, value, onChange, emptyHint,
}: Props<T>) {
  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
      )}
      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{emptyHint ?? "None defined yet."}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const active = value.includes(o.value);
            return (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
