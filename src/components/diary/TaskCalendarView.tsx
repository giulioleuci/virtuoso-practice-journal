import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { subjectBorderStyle } from "@/lib/subjectColors";
import type { Task, Subject } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useTasksInRange } from "@/hooks/useEntities";
function utcDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Props {
  subjects: Subject[];
}

export function TaskCalendarView({ subjects }: Props) {
  const { t, lang } = useI18n();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const initYear = parseInt(today.slice(0, 4));
  const initMonth = parseInt(today.slice(5, 7)) - 1;
  const [displayYear, setDisplayYear] = useState(initYear);
  const [displayMonth, setDisplayMonth] = useState(initMonth);

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
    return d.toLocaleString(lang, { month: "long", year: "numeric" });
  }, [displayYear, displayMonth, lang]);

  // Monday-first day headers using i18n weekday keys [1,2,3,4,5,6,0]
  const dayHeaders = [1, 2, 3, 4, 5, 6, 0].map((d) => t(`weekday.${d}`).slice(0, 2));

  const prevMonth = () => {
    const newYear = displayMonth === 0 ? displayYear - 1 : displayYear;
    const newMonth = displayMonth === 0 ? 11 : displayMonth - 1;
    setDisplayYear(newYear);
    setDisplayMonth(newMonth);
    setSelectedDate(utcDateStr(newYear, newMonth, 1));
  };

  const nextMonth = () => {
    const newYear = displayMonth === 11 ? displayYear + 1 : displayYear;
    const newMonth = displayMonth === 11 ? 0 : displayMonth + 1;
    setDisplayYear(newYear);
    setDisplayMonth(newMonth);
    setSelectedDate(utcDateStr(newYear, newMonth, 1));
  };

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];
  const subjectName = (id: number) => subjects.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-3">
      <div className="paper-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground"
            aria-label={t("calendar.prevMonth")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium capitalize">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground"
            aria-label={t("calendar.nextMonth")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center">
          {dayHeaders.map((d, i) => (
            <span key={i} className="text-xs text-muted-foreground font-medium py-1">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {gridCells.map((dateStr, idx) => {
            if (!dateStr) return <div key={idx} />;
            const taskList = tasksByDate.get(dateStr);
            const hasTasks = (taskList?.length ?? 0) > 0;
            const hasActive = taskList?.some((task) => !task.done) ?? false;
            const allDone = hasTasks && !hasActive;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "flex flex-col items-center justify-center h-9 w-9 mx-auto rounded-md text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "hover:bg-accent/60",
                )}
              >
                <span>{parseInt(dateStr.slice(-2))}</span>
                {hasTasks && (
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full",
                      isSelected
                        ? "bg-primary-foreground"
                        : allDone
                        ? "bg-muted-foreground/40"
                        : "bg-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        {selectedTasks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground italic py-2">
            {t("tasks.noTasksOnDay")}
          </p>
        ) : (
          selectedTasks.map((task) => {
            const subject = subjects.find((s) => s.id === task.subjectId);
            return (
              <div
                key={task.id}
                className={cn("paper-card p-2.5 flex items-center gap-2 border-l-4", task.done && "opacity-60")}
                style={subjectBorderStyle(subject?.color, subject?.type, subject?.customColor)}
              >
                <span className={cn("text-sm flex-1 min-w-0 truncate", task.done && "line-through")}>
                  {task.title}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{subjectName(task.subjectId)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
