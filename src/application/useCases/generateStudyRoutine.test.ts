import { describe, expect, it } from "vitest";
import { GenerateStudyRoutineUseCase } from "./generateStudyRoutine";
import type { Task } from "@/domain/entities/task";
import type { StudyRoutine, StudyRoutineGenerationPort, StudyRoutineInput } from "@/domain/ports/studyRoutine";

const input: StudyRoutineInput = { name: "Week", subjectId: 1, groups: [{ id: "g", name: "Group", pool: [{ type: "item", id: 2 }] }], matrix: { "1": { g: 1 } }, weeksAhead: 1, repetitionCap: 1, useSpacedRepetition: false, startDate: "2026-07-20" };
const port = (): StudyRoutineGenerationPort => ({
  createRoutine: async (value, createdAt): Promise<StudyRoutine> => (portState.created = { ...value, id: 3, createdAt }),
  resolvePool: async () => new Map([["item:2", { key: "item:2", type: "item", title: "Prelude", itemId: 2, linkType: "item" }]]),
  stats: async () => new Map(),
  weekStartsOn: async () => 1,
  persistTasks: async (tasks) => { portState.tasks = tasks; },
});
const portState: { tasks: Omit<Task, "id">[]; created?: StudyRoutine } = { tasks: [] };
describe("GenerateStudyRoutineUseCase", () => {
  it("resolves pool and persists generated matrix tasks", async () => {
    portState.tasks = [];
    await expect(new GenerateStudyRoutineUseCase(port(), () => 7).execute(input)).resolves.toBe(3);
    expect(portState.tasks).toEqual([expect.objectContaining({ title: "Prelude", studyRoutineId: 3, createdAt: 7 })]);
  });
  it("writes only the 14-day window and stamps the routine", async () => {
    portState.tasks = [];
    const everyDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), { g: 1 }]));
    await new GenerateStudyRoutineUseCase(port(), () => Date.parse("2026-07-20T12:00:00")).execute({ ...input, matrix: everyDay, weeksAhead: 49, repetitionCap: 7 });
    expect(portState.tasks.map((t) => t.date).sort().at(-1)).toBe("2026-08-03");
    expect(portState.created?.materializedUntil).toBe("2026-08-03");
  });
  it("rejects an empty horizon", async () => { await expect(new GenerateStudyRoutineUseCase(port()).execute({ ...input, weeksAhead: 0 })).rejects.toThrow("week"); });
});
