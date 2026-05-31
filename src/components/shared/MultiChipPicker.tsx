import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  placeholder?: string;
}

export function MultiChipPicker<T extends string | number>({
  label, options, value, onChange, emptyHint, placeholder,
}: Props<T>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const remove = (v: T) => onChange(value.filter((x) => x !== v));

  const effectivePlaceholder = placeholder ?? `${t("common.select")}…`;
  const selectedOpts = options.filter((o) => value.includes(o.value));
  const summary =
    selectedOpts.length === 0
      ? effectivePlaceholder
      : selectedOpts.length <= 2
      ? selectedOpts.map((o) => o.label).join(", ")
      : t("common.selected", { count: selectedOpts.length });

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
      )}
      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{emptyHint ?? t("common.noneDefinedYet")}</p>
      ) : (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-input bg-card text-sm transition-colors hover:bg-accent/40",
                  selectedOpts.length === 0 && "text-muted-foreground"
                )}
              >
                <span className="truncate text-left">{summary}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-1 w-[--radix-popover-trigger-width] max-h-72 overflow-y-auto" align="start">
              <ul className="space-y-0.5">
                {options.map((o) => {
                  const active = value.includes(o.value);
                  return (
                    <li key={String(o.value)}>
                      <button
                        type="button"
                        onClick={() => toggle(o.value)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left transition-colors hover:bg-accent",
                          active && "text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                            active ? "bg-primary border-primary text-primary-foreground" : "border-input"
                          )}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{o.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>

          {selectedOpts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedOpts.map((o) => (
                <span
                  key={String(o.value)}
                  className="inline-flex items-center gap-1 text-xs pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-primary"
                >
                  {o.label}
                  <button
                    type="button"
                    onClick={() => remove(o.value)}
                    className="hover:text-destructive p-0.5"
                    aria-label={t("common.removeItem", { label: o.label })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
