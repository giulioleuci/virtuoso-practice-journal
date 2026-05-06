import { describe, it, expect } from "vitest";
import { tasksService } from "./tasks";

describe("tasksService surface", () => {
  it("exposes the expected methods", () => {
    expect(typeof tasksService.list).toBe("function");
    expect(typeof tasksService.create).toBe("function");
    expect(typeof tasksService.update).toBe("function");
    expect(typeof tasksService.toggleDone).toBe("function");
    expect(typeof tasksService.remove).toBe("function");
    expect(typeof tasksService.bulkRemove).toBe("function");
  });
});
