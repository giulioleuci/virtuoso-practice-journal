import { describe, it, expect } from "vitest";
import { sessionInputSchema, taskInputSchema, flattenErrors, bpmSchema } from "./schemas";

describe("bpmSchema", () => {
  it("accepts in-range integers", () => {
    expect(bpmSchema.safeParse(120).success).toBe(true);
  });
  it("rejects out-of-range", () => {
    expect(bpmSchema.safeParse(10).success).toBe(false);
    expect(bpmSchema.safeParse(500).success).toBe(false);
  });
});

describe("sessionInputSchema", () => {
  it("accepts a minimal valid session", () => {
    const r = sessionInputSchema.safeParse({ quality: "well" });
    expect(r.success).toBe(true);
  });
  it("rejects invalid confidence", () => {
    const r = sessionInputSchema.safeParse({ quality: "well", confidence: 9 });
    expect(r.success).toBe(false);
  });
  it("rejects invalid quality", () => {
    const r = sessionInputSchema.safeParse({ quality: "amazing" });
    expect(r.success).toBe(false);
  });
});

describe("taskInputSchema", () => {
  it("requires title and ISO date", () => {
    const ok = taskInputSchema.safeParse({
      title: "Practice scales",
      date: "2025-01-01",
      subjectId: 1,
    });
    expect(ok.success).toBe(true);

    const bad = taskInputSchema.safeParse({
      title: "",
      date: "01/01/2025",
      subjectId: 1,
    });
    expect(bad.success).toBe(false);
  });
});

describe("flattenErrors", () => {
  it("returns [] when valid", () => {
    expect(flattenErrors(bpmSchema.safeParse(100))).toEqual([]);
  });
  it("returns string messages on failure", () => {
    const errs = flattenErrors(bpmSchema.safeParse(0));
    expect(errs.length).toBeGreaterThan(0);
  });
});
