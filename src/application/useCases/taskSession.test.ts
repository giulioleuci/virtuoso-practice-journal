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
  plan: [],
  done: false,
  createdAt: 1,
};
const rated = (segmentId?: number) => ({ segmentId, layers: [], techniques: [], mood: 4, focus: 3, confidence: 5 });
const sectioned = { ...baseTask, linkType: "item" as const, itemId: 9, plan: [1, 2, 3].map((segmentId) => ({ segmentId, layers: [], techniques: [] })) };

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
    expect(tasks.createRecurringCalls).toBe(1);
  });

  it("clamps invalid interval steps and caps an unbounded recurrence", async () => {
    const tasks = new FakeTaskRepository();
    const useCase = new CreateTaskUseCase(tasks, () => 10);

    await useCase.execute({
      ...baseTask,
      recurrence: { kind: "interval", everyXDays: 0, startDate: "2026-07-20" },
    });

    expect(tasks.created).toHaveLength(200);
    expect(tasks.created[1].date).toBe("2026-07-21");
    expect(tasks.createRecurringCalls).toBe(1);
  });

  it("caps explicitly requested recurrence occurrences", async () => {
    const tasks = new FakeTaskRepository();
    const useCase = new CreateTaskUseCase(tasks, () => 10);

    await useCase.execute({
      ...baseTask,
      recurrence: { kind: "interval", everyXDays: 1, startDate: "2026-07-20", occurrences: 10_000 },
    });

    expect(tasks.created).toHaveLength(200);
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

    await useCase.execute(baseTask, { date: "2026-07-20", marks: [{ ...rated(), confidence: 3 }], helpText: "How to relax?" });

    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0].snapshot?.taskTitle).toBe("Scales");
    expect(sessions.helpRequests[0]).toMatchObject({ taskId: 1, question: "How to relax?" });
    expect(tasks.updated.get(1)).toEqual({ done: true });
    expect(sessions.sessions[0]).toMatchObject({ createdAt: 88, marks: [{ confidence: 3 }] });
  });

  it("assembles an effective snapshot and rolls back when help persistence fails", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const sessions = new FakeSessionRepository(tasks);
    const useCase = new LogSessionUseCase(sessions, () => 88);

    await useCase.execute(baseTask, { date: "2026-07-20", marks: [{ ...rated(), bpm: 120, layers: ["hands"], techniques: [4], confidence: 3 }] });
    expect(sessions.sessions[0].snapshot).toMatchObject({ techniqueNames: ["technique 4"] });

    sessions.failHelpRequest = true;
    await expect(useCase.execute(baseTask, { date: "2026-07-20", marks: [{ ...rated(), confidence: 3 }], helpText: "Need help" })).rejects.toThrow("help persistence failed");
    expect(sessions.sessions).toHaveLength(1);
    expect(tasks.updated.get(1)).toEqual({ done: true });
  });

  it("resets a task after its last session is deleted", async () => {
    const tasks = new FakeTaskRepository([{ ...baseTask, done: true }]);
    const sessions = new FakeSessionRepository(tasks, [{ id: 4, taskId: 1, date: baseTask.date, marks: [], createdAt: 1 }]);
    const useCase = new DeleteSessionUseCase(sessions);

    await useCase.execute(4, 1);

    expect(tasks.updated.get(1)).toEqual({ done: false });
  });

  it("saves a free session without creating or completing any task", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const sessions = new FakeSessionRepository(tasks);

    await new LogSessionUseCase(sessions, () => 5).execute(
      { subjectId: 1, linkType: "free", title: "Improvisation", plan: [] },
      { date: "2026-07-20", marks: [rated()] },
    );

    expect(sessions.sessions[0]).toMatchObject({ subjectId: 1, linkType: "free", marks: [{ mood: 4, focus: 3, confidence: 5 }] });
    expect(sessions.sessions[0].taskId).toBeUndefined();
    expect(tasks.created).toHaveLength(0);
    expect(tasks.updated.size).toBe(0);
  });

  it("rejects a new session with a missing rating and saves nothing", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const sessions = new FakeSessionRepository(tasks);

    await expect(new LogSessionUseCase(sessions).execute(baseTask, { date: "2026-07-20", marks: [{ layers: [], techniques: [], mood: 4, confidence: 5 }] })).rejects.toThrow(/focus/);
    await expect(new LogSessionUseCase(sessions).execute(sectioned, { date: "2026-07-20", marks: [rated(1), rated(1)] })).rejects.toThrow(/once/);
    expect(sessions.sessions).toHaveLength(0);
  });

  it("stores one rated result per studied section and records the planned ones left out", async () => {
    const tasks = new FakeTaskRepository([sectioned]);
    const sessions = new FakeSessionRepository(tasks);

    await new LogSessionUseCase(sessions).execute(sectioned, { date: "2026-07-20", marks: [rated(1), rated(3)] });

    expect(sessions.sessions[0].marks.map((m) => m.segmentId)).toEqual([1, 3]);
    expect(sessions.sessions[0].notStudied).toEqual([2]);
    expect(sessions.sessions[0]).toMatchObject({ taskId: 1, itemId: 9, linkType: "item" });
    expect(tasks.updated.get(1)).toEqual({ done: false });
  });

  it("completes a task from cumulative coverage and reopens it when a covering session is deleted", async () => {
    const tasks = new FakeTaskRepository([sectioned]);
    const sessions = new FakeSessionRepository(tasks);
    const log = new LogSessionUseCase(sessions);

    await log.execute(sectioned, { date: "2026-07-20", marks: [rated(1), rated(2)] });
    await log.execute(sectioned, { date: "2026-07-21", marks: [rated(3)] });
    expect(tasks.updated.get(1)).toEqual({ done: true });

    await new DeleteSessionUseCase(sessions).execute(2, 1);
    expect(tasks.updated.get(1)).toEqual({ done: false });
    expect(sessions.sessions[0].marks).toHaveLength(2);
  });
});
