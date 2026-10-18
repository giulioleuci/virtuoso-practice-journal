import { useId, useRef, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A controlled toolbar: pages own their criteria and filtering logic. */
export function FilterPanel({ children, active = false, search, filters = [], onReset, resultCount }: {
  children?: ReactNode;
  active?: boolean;
  search?: SearchProps;
  filters?: ActiveFilter[];
  onReset?: () => void;
  resultCount?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const hasCriteria = active || filters.length > 0 || !!search?.value;
  return (
    <div className="my-4 min-w-0 space-y-3" data-pdf-ignore="true">
      <div className="flex flex-wrap items-center gap-2">
        {search && <SearchField {...search} />}
        {children && <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant={open ? "secondary" : "outline"} className="h-11">
          <SlidersHorizontal aria-hidden="true" /> {t("common.filters")}
          {filters.length > 0 ? <span className="tabular-nums">({filters.length})</span> : active && <span className="h-2 w-2 rounded-full bg-primary" aria-label={t("common.filtersActive")} />}
        </Button></PopoverTrigger>
          <PopoverContent align="end" aria-label={t("common.filters")} className="w-[min(36rem,calc(100vw-2rem))] max-h-[min(70dvh,var(--radix-popover-content-available-height))] overflow-y-auto">
            <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 [&_input]:h-11 [&_[role=combobox]]:h-11">{children}</div>
          </PopoverContent>
        </Popover>}
        {hasCriteria && onReset && <Button type="button" variant="ghost" className="h-11" onClick={onReset}>{t("states.clearFilters")}</Button>}
      </div>
      {filters.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label={t("common.filtersActive")}>
        {filters.map(filter => <Button key={filter.key} type="button" variant="secondary" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left" aria-label={t("common.removeItem", { label: filter.label })} onClick={filter.onRemove}>
          <span className="min-w-0 break-words">{filter.label}</span><X aria-hidden="true" />
        </Button>)}
      </div>}
      {resultCount !== undefined && <p role="status" className="text-xs tabular-nums text-muted-foreground">{t("filters.results", { count: resultCount })}</p>}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: SearchProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const clear = () => { onChange(""); ref.current?.focus(); };
  return <div className="relative min-w-0 flex-[1_1_14rem]">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <Input ref={ref} type="search" value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Escape" && value) { e.preventDefault(); e.stopPropagation(); clear(); } }} placeholder={placeholder ?? t("common.search")} aria-label={placeholder ?? t("common.search")} className="h-11 pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none" />
    {value && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label={t("filters.clearSearch")} onClick={clear}><X aria-hidden="true" /></Button>}
  </div>;
}

/** Labelled filter with page-specific options; values remain owned by its caller. */
export function FilterSelect<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: NoInfer<T>) => void;
  options: { value: NoInfer<T>; label: string }[];
}) {
  const id = useId();
  return <div className="grid min-w-0 gap-1.5">
    <label htmlFor={id} className="text-xs font-medium">{label}</label>
    <Select value={value} onValueChange={v => onChange(v as T)}>
      <SelectTrigger id={id} aria-label={label} className="h-11 min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function FilterDateRange({ from, to, onFromChange, onToChange }: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return <div className="grid min-w-0 grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:col-span-2">
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">{t("common.from")}<Input type="date" value={from} max={to || undefined} onChange={e => onFromChange(e.target.value)} className="h-11 min-w-0" /></label>
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">{t("common.to")}<Input type="date" value={to} min={from || undefined} onChange={e => onToChange(e.target.value)} className="h-11 min-w-0" /></label>
  </div>;
}
