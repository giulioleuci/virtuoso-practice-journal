import { describe, expect, it } from "vitest";
import { GenerateStudyRoutineUseCase } from "./generateStudyRoutine";

const input = { name: "Week", subjectId: 1, groups: [{ id: "g", name: "Group", pool: [{ type: "item" as const, id: 2 }] }], matrix: { "1": { g: 1 } }, weeksAhead: 1, repetitionCap: 1, useSpacedRepetition: false, startDate: "2026-07-20" };
const port = () => ({ create: async () => 3, regenerateFromDate: async () => {}, update: async () => {}, remove: async () => {} });
describe("GenerateStudyRoutineUseCase", () => {
  it("persists a valid routine", async () => { await expect(new GenerateStudyRoutineUseCase(port()).execute(input)).resolves.toBe(3); });
  it("rejects an empty horizon", async () => { await expect(new GenerateStudyRoutineUseCase(port()).execute({ ...input, weeksAhead: 0 })).rejects.toThrow("week"); });
});
