import type { NewTaskInput, TaskPort } from "@/domain/ports/task";
import { dayKey, parseDayKey } from "@/lib/date";

const MAX_GENERATED = 200;
const HORIZON_DAYS = 365;

function recurrenceDates(recurrence: NonNullable<NewTaskInput["recurrence"]>): string[] {
  const dates: string[] = [];
  const start = parseDayKey(recurrence.startDate);
  const end = recurrence.endDate ? parseDayKey(recurrence.endDate) : null;
  const horizon = new Date(start);
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);
  const cap = recurrence.occurrences ?? MAX_GENERATED;
  const current = new Date(start);
  if (recurrence.kind === "weekdays") {
    const days = recurrence.days ?? [];
    if (!days.length) return [];
    while (dates.length < cap && current <= horizon) {
      if (end && current > end) break;
      if (days.includes(current.getDay())) dates.push(dayKey(current));
      current.setDate(current.getDate() + 1);
    }
  } else {
    const step = Math.max(1, recurrence.everyXDays ?? 1);
    while (dates.length < cap && current <= horizon) {
      if (end && current > end) break;
      dates.push(dayKey(current));
      current.setDate(current.getDate() + step);
    }
  }
  return dates;
}

export class CreateTaskUseCase {
  constructor(private readonly tasks: TaskPort, private readonly clock: () => number = Date.now) {}
  async execute(input: NewTaskInput): Promise<number> {
    const { recurrence, ...rest } = input;
    const createdAt = this.clock();
    if (!recurrence) return this.tasks.create({ ...rest, done: false, createdAt });
    const dates = recurrenceDates(recurrence);
    if (!dates.length) throw new Error("Recurrence produced no dates");
    return this.tasks.createRecurring(
      { ...rest, date: dates[0], recurrence, done: false, createdAt },
      dates.slice(1).map((date) => ({ ...rest, date, done: false, createdAt })),
    );
  }
}
