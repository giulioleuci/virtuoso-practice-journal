import { describe, expect, it } from "vitest";
import { isOpenAssignment, needsTask } from "./assignments";

const tasks = new Map([[1, { done: true }], [2, { done: false }]]);

describe("assignments", () => {
  it("needs a task only while unlinked and not ignored", () => {
    expect(needsTask({ taskIds: [] })).toBe(true);
    expect(needsTask({ taskIds: [1] })).toBe(false);
    expect(needsTask({ taskIds: [], ignored: true })).toBe(false);
  });
  it("stays open while any linked task is pending", () => {
    expect(isOpenAssignment({ taskIds: [] }, tasks)).toBe(true);
    expect(isOpenAssignment({ taskIds: [1] }, tasks)).toBe(false);
    expect(isOpenAssignment({ taskIds: [1, 2] }, tasks)).toBe(true);
    expect(isOpenAssignment({ taskIds: [2], ignored: true }, tasks)).toBe(false);
  });
});
