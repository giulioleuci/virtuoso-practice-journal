import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LANG_LOCALE, addDays, dayKey, getDefaultWeekStartsOn, parseDayKey, startOfWeek } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { useTasksInRange } from "@/presentation/hooks/useEntities";
import { cn } from "@/lib/utils";

/** The week of the selected date, full width; a dot marks days that already have tasks. */
export function WeekStrip({ date, onSelect }: {
  date: string;
  onSelect: (date: string) => void;
}) {
  const { t, lang } = useI18n();
  const days = useMemo(() => {
    const start = startOfWeek(parseDayKey(date), getDefaultWeekStartsOn(lang));
    return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));
  }, [date, lang]);
  const tasks = useTasksInRange(days[0], days[6]);
  const withTasks = useMemo(() => new Set((tasks ?? []).map((task) => task.date)), [tasks]);
  const shift = (n: number) => onSelect(dayKey(addDays(parseDayKey(date), n)));

  return (
    <div className="flex w-full items-center" role="group" aria-label={t("week.label")}>
      <button type="button" onClick={() => shift(-7)} aria-label={t("week.prev")} className="relative grid h-11 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground before:absolute before:-left-3 before:right-0 before:inset-y-0 before:content-[''] hover:bg-secondary/40">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
        {days.map((d) => {
          const active = d === date;
          const dt = parseDayKey(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-current={active ? "date" : undefined}
              aria-label={`${dt.toLocaleDateString(LANG_LOCALE[lang], { weekday: "long", day: "numeric", month: "long" })}${withTasks.has(d) ? `, ${t("week.hasTasks")}` : ""}`}
              className={cn(
                "min-h-11 min-w-0 rounded-lg py-1 text-center text-xs transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/40",
              )}
            >
              <span className="block capitalize">{dt.toLocaleDateString(LANG_LOCALE[lang], { weekday: "short" })}</span>
              <strong className={cn("block font-numeric text-base font-medium leading-tight", !active && "text-foreground")}>{dt.getDate()}</strong>
              <span className={cn("mx-auto mt-0.5 block h-1 w-1 rounded-full", active ? "bg-primary-foreground" : "bg-primary", !withTasks.has(d) && "invisible")} />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => shift(7)} aria-label={t("week.next")} className="relative grid h-11 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground before:absolute before:-right-3 before:left-0 before:inset-y-0 before:content-[''] hover:bg-secondary/40">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
