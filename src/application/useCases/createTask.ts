import type { Task } from "@/domain/entities/task";
import type { NewTaskInput, TaskPort } from "@/domain/ports/task";

function recurrenceDates(recurrence: NonNullable<NewTaskInput["recurrence"]>): string[] {
  if (recurrence.kind === "weekdays" && !recurrence.days?.length) return [];
  if (recurrence.kind === "interval" && recurrence.everyXDays !== undefined && recurrence.everyXDays < 1) return [];
  const result: string[] = [];
  const date = new Date(`${recurrence.startDate}T00:00:00`);
  const end = recurrence.endDate ? new Date(`${recurrence.endDate}T00:00:00`) : undefined;
  while ((!end || date <= end) && (!recurrence.occurrences || result.length < recurrence.occurrences)) {
    if (recurrence.kind === "interval" || recurrence.days!.includes(date.getDay())) {
      result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
    }
    date.setDate(date.getDate() + (recurrence.kind === "interval" ? recurrence.everyXDays ?? 1 : 1));
  }
  return result;
}

export class CreateTaskUseCase {
  constructor(private readonly tasks: TaskPort, private readonly clock: () => number = Date.now) {}
  async execute(input: NewTaskInput): Promise<number> {
    const { recurrence, ...rest } = input;
    const createdAt = this.clock();
    if (!recurrence) return this.tasks.create({ ...rest, done: false, createdAt });
    const dates = recurrenceDates(recurrence);
    if (!dates.length) throw new Error("Recurrence produced no dates");
    const [firstId] = await this.tasks.createBatch([{ ...rest, date: dates[0], recurrence, done: false, createdAt } as Omit<Task, "id">]);
    if (dates.length > 1) await this.tasks.createBatch(dates.slice(1).map((date) => ({ ...rest, date, done: false, recurrenceTaskId: firstId, createdAt })));
    return firstId;
  }
}
