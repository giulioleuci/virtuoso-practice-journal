import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
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
export function FilterPanel({ children, sorting, active = false, search, filters = [], onReset, resultCount }: {
  children?: ReactNode;
  sorting?: ReactNode;
  active?: boolean;
  search?: SearchProps;
  filters?: ActiveFilter[];
  onReset?: () => void;
  resultCount?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<"filters" | "sort" | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const focusToolbar = () => toolbar.current?.querySelector<HTMLElement>('input[type="search"],button[aria-haspopup]')?.focus();
  const hasCriteria = active || filters.length > 0 || !!search?.value;
  return (
    <div ref={toolbar} className="my-4 min-w-0 space-y-2" data-pdf-ignore="true">
      <div className="flex items-center gap-1.5">
        {search && <SearchField {...search} />}
        {[
          { key: "filters" as const, label: t("common.filters"), content: children, Icon: SlidersHorizontal },
          { key: "sort" as const, label: t("link.sortBy"), content: sorting, Icon: ArrowUpDown },
        ].map(({ key, label, content, Icon }) => content && <Popover key={key} open={open === key} onOpenChange={value => setOpen(value ? key : null)}>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant={open === key ? "secondary" : "ghost"} className="relative h-11 w-11 shrink-0" title={label} aria-label={key === "filters" && filters.length ? `${label} (${filters.length})` : label}>
              <Icon aria-hidden="true" />
              {key === "filters" && (filters.length > 0 ? <span aria-hidden="true" className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground tabular-nums">{filters.length}</span> : active && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label={label} className={`${key === "filters" ? "w-[min(36rem,calc(100vw-2rem))]" : "w-[min(24rem,calc(100vw-2rem))]"} max-h-[min(70dvh,var(--radix-popover-content-available-height))] overflow-y-auto`}>
            <p className="mb-3 text-sm font-medium">{label}</p>
            <div className={`grid min-w-0 grid-cols-1 items-end gap-3 ${key === "filters" ? "sm:grid-cols-2" : ""} [&_input]:h-11 [&_[role=combobox]]:h-11`}>{content}</div>
          </PopoverContent>
        </Popover>)}
      </div>
      {(filters.length > 0 || (hasCriteria && (resultCount !== undefined || onReset))) && <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {filters.length > 0 && <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label={t("common.filtersActive")}>
          {filters.map(filter => <Button key={filter.key} type="button" variant="secondary" size="sm" className="h-auto min-h-11 max-w-full whitespace-normal px-2 py-1.5 text-left" aria-label={t("common.removeItem", { label: filter.label })} onClick={() => { filter.onRemove(); focusToolbar(); }}>
            <span className="min-w-0 break-words">{filter.label}</span><X aria-hidden="true" />
          </Button>)}
        </div>}
        {hasCriteria && resultCount !== undefined && <p role="status" className="text-xs tabular-nums text-muted-foreground">{t("filters.results", { count: resultCount })}</p>}
        {hasCriteria && onReset && <Button type="button" size="icon" variant="ghost" className="ml-auto h-11 w-11 shrink-0" title={t("states.clearFilters")} aria-label={t("states.clearFilters")} onClick={() => { onReset(); focusToolbar(); }}><RotateCcw aria-hidden="true" /></Button>}
      </div>}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: SearchProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const clear = () => { onChange(""); ref.current?.focus(); };
  return <div className="relative min-w-0 flex-1">
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
