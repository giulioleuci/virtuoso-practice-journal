import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { subjectColorCss } from "@/lib/subjectColors";
import type { Subject } from "@/domain/entities/common";
import type { Task } from "@/domain/entities/task";
import { formatDate, today as todayKey } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { useTasksInRange } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";

function utcDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Props {
  subjects: Subject[];
}

/** Month grid with the selected day's tasks listed underneath. */
export function TaskCalendarView({ subjects }: Props) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const today = todayKey();
  const [selectedDate, setSelectedDate] = useState(today);

  const [displayYear, setDisplayYear] = useState(parseInt(today.slice(0, 4)));
  const [displayMonth, setDisplayMonth] = useState(parseInt(today.slice(5, 7)) - 1);

  const monthFrom = utcDateStr(displayYear, displayMonth, 1);
  const monthTo = utcDateStr(
    displayYear,
    displayMonth,
    new Date(Date.UTC(displayYear, displayMonth + 1, 0)).getUTCDate(),
  );
  const tasks = useTasksInRange(monthFrom, monthTo);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      const arr = map.get(task.date) ?? [];
      arr.push(task);
      map.set(task.date, arr);
    }
    return map;
  }, [tasks]);

  const gridCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(displayYear, displayMonth, 1));
    const lastDay = new Date(Date.UTC(displayYear, displayMonth + 1, 0));
    const startOffset = (firstDay.getUTCDay() + 6) % 7; // Monday = 0
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= lastDay.getUTCDate(); d++) {
      cells.push(utcDateStr(displayYear, displayMonth, d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [displayYear, displayMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(displayYear, displayMonth, 1));
    return d.toLocaleString(lang, { month: "long", year: "numeric", timeZone: "UTC" });
  }, [displayYear, displayMonth, lang]);

  // Monday-first day headers using i18n weekday keys [1,2,3,4,5,6,0]
  const dayHeaders = [1, 2, 3, 4, 5, 6, 0].map((d) => t(`weekday.${d}`).slice(0, 3));

  const goTo = (year: number, month: number) => {
    setDisplayYear(year);
    setDisplayMonth(month);
    setSelectedDate(utcDateStr(year, month, 1));
  };
  const step = (n: number) => {
    const d = new Date(Date.UTC(displayYear, displayMonth + n, 1));
    goTo(d.getUTCFullYear(), d.getUTCMonth());
  };
  const goToday = () => {
    goTo(parseInt(today.slice(0, 4)), parseInt(today.slice(5, 7)) - 1);
    setSelectedDate(today);
  };

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];
  const subjectOf = (task: Task) => subjects.find((s) => s.id === task.subjectId);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-[1.75rem] font-semibold capitalize leading-tight">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => step(-1)} aria-label={t("calendar.prevMonth")}>
            <ChevronLeft />
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>{t("calendar.today")}</Button>
          <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => step(1)} aria-label={t("calendar.nextMonth")}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-border text-xs">
        {dayHeaders.map((d, i) => (
          <span key={i} className="border-b border-r border-border bg-card px-2 py-1.5 font-medium capitalize text-muted-foreground">{d}</span>
        ))}
        {gridCells.map((dateStr, idx) => {
          if (!dateStr) return <div key={idx} className="min-h-[52px] border-b border-r border-border min-[700px]:min-h-[96px]" />;
          const list = tasksByDate.get(dateStr) ?? [];
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr)}
              aria-pressed={isSelected}
              aria-label={`${formatDate(dateStr, lang, "long")}: ${t("calendar.tasksOnDay", { count: list.length })}`}
              className={cn(
                "flex min-h-[52px] flex-col items-stretch gap-0.5 border-b border-r border-border p-1.5 text-left transition-colors min-[700px]:min-h-[96px]",
                isSelected ? "bg-primary/10" : "hover:bg-secondary/40",
              )}
            >
              <strong className={cn("font-numeric text-sm font-medium", dateStr === today && "text-primary")}>{parseInt(dateStr.slice(-2))}</strong>
              <span className="hidden min-w-0 flex-col gap-0.5 min-[700px]:flex">
                {list.slice(0, 2).map((task) => (
                  <span key={task.id} className={cn("flex items-center gap-1 truncate px-1 text-[0.6875rem] leading-5", task.done ? "text-muted-foreground line-through" : "text-foreground")}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(subjectOf(task)?.color, subjectOf(task)?.type, subjectOf(task)?.customColor) }} />
                    <span className="truncate">{task.title}</span>
                  </span>
                ))}
                {list.length > 2 && <span className="px-1 text-[0.6875rem] text-muted-foreground">{t("calendar.moreN", { count: list.length - 2 })}</span>}
              </span>
              {list.length > 0 && <span className={cn("mt-auto h-1 w-1 rounded-full min-[700px]:hidden", list.some((x) => !x.done) ? "bg-primary" : "bg-muted-foreground/40")} />}
            </button>
          );
        })}
      </div>

      <section className="mt-6">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="font-serif text-xl font-semibold capitalize">{formatDate(selectedDate, lang, "long")}</h3>
          <Button size="sm" onClick={() => navigate("/tasks/new", { state: { date: selectedDate } })}>
            <Plus />{t("calendar.addTask")}
          </Button>
        </div>
        {selectedTasks.length === 0 ? (
          <p className="border-t border-border py-6 text-center text-sm italic text-muted-foreground">{t("tasks.noTasksOnDay")}</p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {selectedTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColorCss(subjectOf(task)?.color, subjectOf(task)?.type, subjectOf(task)?.customColor) }} title={subjectOf(task)?.name} role="img" aria-label={subjectOf(task)?.name} />
                <Link to={`/tasks/edit/${task.id}`} className={cn("min-w-0 flex-1 truncate text-sm font-medium hover:underline underline-offset-4", task.done && "text-muted-foreground line-through")}>
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
