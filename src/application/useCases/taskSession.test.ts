import { describe, expect, it } from "vitest";
import { CreateTaskUseCase } from "./createTask";
import { RemoveTaskUseCase } from "./removeTask";
import { UpdateTaskUseCase } from "./updateTask";
import { LogSessionUseCase } from "./logSession";
import { DeleteSessionUseCase } from "./deleteSession";
import { FakeTaskRepository } from "@/test/fakes/FakeTaskRepository";
import { FakeSessionRepository } from "@/test/fakes/FakeSessionRepository";

const baseTask = {
  id: 1,
  date: "2026-07-20",
  subjectId: 1,
  linkType: "free" as const,
  title: "Scales",
  done: false,
  createdAt: 1,
};

describe("task and session use cases", () => {
  it("expands a recurrence before persisting it", async () => {
    const tasks = new FakeTaskRepository();
    const useCase = new CreateTaskUseCase(tasks, () => 10);

    const id = await useCase.execute({
      ...baseTask,
      recurrence: { kind: "weekdays", days: [1, 3], startDate: "2026-07-20", occurrences: 2 },
    });

    expect(id).toBe(1);
    expect(tasks.created.map((task) => task.date)).toEqual(["2026-07-20", "2026-07-22"]);
    expect(tasks.created[1].recurrenceTaskId).toBe(1);
  });

  it("rejects a recurrence that yields no dates", async () => {
    const tasks = new FakeTaskRepository();
    const useCase = new CreateTaskUseCase(tasks, () => 10);

    await expect(useCase.execute({
      ...baseTask,
      recurrence: { kind: "weekdays", days: [], startDate: "2026-07-20", occurrences: 2 },
    })).rejects.toThrow("Recurrence produced no dates");
  });

  it("soft deletes tasks with sessions and hard deletes the rest", async () => {
    const tasks = new FakeTaskRepository([baseTask, { ...baseTask, id: 2 }]);
    tasks.sessionTaskIds.add(1);
    const useCase = new RemoveTaskUseCase(tasks, () => 100);

    await expect(useCase.execute(1)).resolves.toBe("soft");
    await expect(useCase.execute(2)).resolves.toBe("hard");
    expect(tasks.updated.get(1)).toEqual({ deletedAt: 100 });
    expect(tasks.deleted).toEqual([2]);
  });

  it("carries an incomplete task to another date and skips source", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const useCase = new UpdateTaskUseCase(tasks, () => 99);

    const id = await useCase.carryOver(baseTask, "2026-07-21");

    expect(id).toBe(2);
    expect(tasks.created[0]).toMatchObject({ date: "2026-07-21", done: false, createdAt: 99 });
    expect(tasks.updated.get(1)).toEqual({ skipped: true });
  });

  it("logs completion and optional help request atomically", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const sessions = new FakeSessionRepository(tasks);
    const useCase = new LogSessionUseCase(sessions, () => 88);

    await useCase.execute(baseTask, { date: "2026-07-20", confidence: 3, helpText: "How to relax?" });

    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0].snapshot?.taskTitle).toBe("Scales");
    expect(sessions.helpRequests[0]).toMatchObject({ taskId: 1, question: "How to relax?" });
    expect(tasks.updated.get(1)).toEqual({ done: true });
  });

  it("resets a task after its last session is deleted", async () => {
    const tasks = new FakeTaskRepository([{ ...baseTask, done: true }]);
    const sessions = new FakeSessionRepository(tasks, [{ id: 4, taskId: 1, date: baseTask.date, createdAt: 1 }]);
    const useCase = new DeleteSessionUseCase(sessions);

    await useCase.execute(4, 1);

    expect(tasks.updated.get(1)).toEqual({ done: false });
  });
});
