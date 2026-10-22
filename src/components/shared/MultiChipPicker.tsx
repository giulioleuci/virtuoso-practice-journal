import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ScrollList } from "./ScrollList";
import { useI18n } from "@/lib/i18n";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  selectionSummary?: boolean;
  label?: string;
  options: Option<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  emptyHint?: string;
  placeholder?: string;
}

export function MultiChipPicker<T extends string | number>({
  label, options, value, onChange, emptyHint, placeholder, selectionSummary = false,
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
        <Label className="text-xs font-medium text-foreground">
          {label}
        </Label>
      )}
      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{emptyHint ?? t("common.noneDefinedYet")}</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
          <Popover modal open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={label ?? effectivePlaceholder}
                className={cn(
                  "w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-input bg-card text-sm transition-colors hover:bg-accent/40",
                  selectedOpts.length === 0 && "text-muted-foreground"
                )}
              >
                <span className="truncate text-left">{selectionSummary ? effectivePlaceholder : summary}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-1 w-[min(24rem,calc(100vw-2rem))]" align="start">
              <div className="mb-1 flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange(options.map((o) => o.value))}>{t("common.selectAll")}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>{t("common.removeAll")}</Button>
              </div>
              <ScrollList><ul className="space-y-0.5">
                {options.map((o) => {
                  const active = value.includes(o.value);
                  return (
                    <li key={String(o.value)}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        onClick={() => toggle(o.value)}
                        className={cn(
                          "w-full min-h-11 flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left transition-colors hover:bg-accent",
                          active && "text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded-sm border-2 flex items-center justify-center shrink-0",
                            active ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground bg-background"
                          )}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{o.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul></ScrollList>
            </PopoverContent>
          </Popover>
          {selectionSummary && <Popover modal>
            <PopoverTrigger asChild>
              <button type="button" disabled={!selectedOpts.length} aria-label={`${label ?? effectivePlaceholder}: ${t("common.selected", { count: selectedOpts.length })}`} className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-input text-sm tabular-nums hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{selectedOpts.length}</button>
            </PopoverTrigger>
            <PopoverContent align="end" aria-label={label} className="w-[min(24rem,calc(100vw-2rem))] p-2">
              <ScrollList><ul className="divide-y divide-border">{selectedOpts.map(o => <li key={String(o.value)} className="break-words px-2 py-2 text-sm">{o.label}</li>)}</ul></ScrollList>
            </PopoverContent>
          </Popover>}
          </div>

          {!selectionSummary && selectedOpts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedOpts.map((o) => (
                <Button
                  key={String(o.value)}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => remove(o.value)}
                  className="h-auto min-h-11 max-w-full whitespace-normal px-2 py-1.5 text-left"
                  aria-label={t("common.removeItem", { label: o.label })}
                >
                  <span className="min-w-0 break-words">{o.label}</span><X aria-hidden="true" />
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
