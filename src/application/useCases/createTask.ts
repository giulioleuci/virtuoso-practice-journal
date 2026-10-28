import { tempoRuleSchema } from "@/lib/schemas";
import type { NewTaskInput, TaskPort } from "@/domain/ports/task";
import { dayKey } from "@/lib/date";
import { windowedRecurrenceDates } from "@/lib/recurrence";

export class CreateTaskUseCase {
  constructor(private readonly tasks: TaskPort, private readonly clock: () => number = Date.now) {}
  async execute(input: NewTaskInput): Promise<number> {
    const { recurrence, ...rest } = input;
    if (input.tempoRule) {
      tempoRuleSchema.parse(input.tempoRule);
      if (!recurrence) throw new Error("Tempo rule requires recurrence");
      rest.tempoRuleRevision = 1;
    }
    const { tempoRule: _rule, tempoRuleRevision: _revision, ...child } = rest;
    const createdAt = this.clock();
    if (!recurrence) return this.tasks.create({ ...rest, done: false, createdAt });
    const dates = windowedRecurrenceDates(recurrence, undefined, dayKey(new Date(createdAt)));
    if (!dates.length) throw new Error("Recurrence produced no dates");
    return this.tasks.createRecurring(
      { ...rest, date: dates[0], recurrence, materializedUntil: dates.at(-1), done: false, createdAt },
      dates.slice(1).map((date) => ({ ...child, date, done: false, createdAt })),
    );
  }
}
