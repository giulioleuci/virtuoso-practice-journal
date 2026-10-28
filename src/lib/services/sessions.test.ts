import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/infrastructure/dexie/db";
import { sessionsService } from "@/lib/services/sessions";
import { tasksService } from "@/lib/services/tasks";

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1_000_000 });
  await db.profile.put({
    id: "me",
    name: "Test",
    lang: "en",
    reminderTime: "18:00",
    reminderFreq: "daily",
    reminderDays: [0, 1, 2, 3, 4, 5, 6],
    lateRecoveryDays: 3,
    graceDay: true,
    groupByPhase: false,
    onboarded: true,
    createdAt: 1_000_000,
  });
});

const rated = { layers: [], techniques: [], mood: 3, focus: 3, confidence: 3 };

async function seedTask(date = "2025-03-01") {
  const subjectId = (await db.subjects.toArray())[0].id!;
  return tasksService.create({ title: "Scales", date, subjectId, plan: [] });
}

// ---------------------------------------------------------------------------
// logWithCompletion
// ---------------------------------------------------------------------------

describe("sessionsService.logWithCompletion", () => {
  it("creates a session, marks the task done, in one transaction", async () => {
    const taskId = await seedTask();
    const task = (await db.tasks.get(taskId))!;

    expect(task.done).toBe(false);

    const sessionId = await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [{ ...rated, confidence: 4 }],
    });

    const session = await db.sessions.get(sessionId);
    expect(session).toBeDefined();
    expect(session!.taskId).toBe(taskId);
    expect(session!.marks[0].confidence).toBe(4);
    expect(session!.createdAt).toBeGreaterThan(0);

    expect((await db.tasks.get(taskId))!.done).toBe(true);
  });

  it("creates a help request when helpText is provided", async () => {
    const taskId = await seedTask();
    const task = (await db.tasks.get(taskId))!;

    await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
      helpText: "How should I finger this?",
    });

    const help = await db.helpRequests.toArray();
    expect(help).toHaveLength(1);
    expect(help[0].question).toBe("How should I finger this?");
    expect(help[0].taskId).toBe(taskId);
    expect(help[0].resolved).toBe(false);
  });

  it("does not create a help request when helpText is absent", async () => {
    const taskId = await seedTask();
    const task = (await db.tasks.get(taskId))!;

    await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
    });

    expect(await db.helpRequests.count()).toBe(0);
  });

  it("stores layers and techniques per mark", async () => {
    const taskId = await seedTask();
    const task = (await db.tasks.get(taskId))!;

    const sessionId = await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [{ ...rated, layers: ["slow"], techniques: [3], confidence: 4 }],
    });

    const session = await db.sessions.get(sessionId);
    expect(session!.marks[0]).toMatchObject({ layers: ["slow"], techniques: [3] });
  });
});

// ---------------------------------------------------------------------------
// deleteWithTaskReset
// ---------------------------------------------------------------------------

describe("sessionsService.deleteWithTaskReset", () => {
  it("deletes the session and resets task.done when no sessions remain", async () => {
    const taskId = await seedTask();
    const task = (await db.tasks.get(taskId))!;

    const sessionId = await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
    });

    expect((await db.tasks.get(taskId))!.done).toBe(true);

    await sessionsService.deleteWithTaskReset(sessionId, taskId);

    expect(await db.sessions.get(sessionId)).toBeUndefined();
    expect((await db.tasks.get(taskId))!.done).toBe(false);
  });

  it("keeps task.done=true when other sessions remain", async () => {
    const taskId = await seedTask();
    const task = (await db.tasks.get(taskId))!;

    const sid1 = await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
    });
    const sid2 = await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
    });

    await sessionsService.deleteWithTaskReset(sid1, taskId);

    expect(await db.sessions.get(sid2)).toBeDefined();
    expect((await db.tasks.get(taskId))!.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteByTaskAndDate
// ---------------------------------------------------------------------------

describe("sessionsService.deleteByTaskAndDate", () => {
  it("deletes all sessions for the task on the given date and marks task not done", async () => {
    const taskId = await seedTask("2025-03-01");
    const task = (await db.tasks.get(taskId))!;

    await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
    });
    await sessionsService.logWithCompletion(task, {
      date: "2025-03-01",
      marks: [rated],
    });

    await sessionsService.deleteByTaskAndDate(taskId, "2025-03-01");

    expect(await db.sessions.count()).toBe(0);
    expect((await db.tasks.get(taskId))!.done).toBe(false);
  });
});
