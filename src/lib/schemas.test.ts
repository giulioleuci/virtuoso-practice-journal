import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NOTE_VALUES } from "@/domain/constants/noteValues";
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
  const mark = { layers: [], techniques: [] };
  it("accepts a minimal valid session", () => {
    expect(sessionInputSchema.safeParse({ marks: [mark] }).success).toBe(true);
  });
  it("rejects invalid confidence", () => {
    expect(sessionInputSchema.safeParse({ marks: [{ ...mark, confidence: 9 }] }).success).toBe(false);
  });
  it("accepts every note value, dotted ones included", () => {
    for (const noteVal of NOTE_VALUES) expect(sessionInputSchema.safeParse({ marks: [{ ...mark, bpm: 60, noteVal }] }).success).toBe(true);
    expect(sessionInputSchema.safeParse({ marks: [{ ...mark, noteVal: "dotted-whole" }] }).success).toBe(false);
  });
});

describe("taskInputSchema", () => {
  it("requires title and ISO date", () => {
    const ok = taskInputSchema.safeParse({
      title: "Practice scales",
      date: "2025-01-01",
      subjectId: 1,
      plan: [],
    });
    expect(ok.success).toBe(true);

    const bad = taskInputSchema.safeParse({
      title: "",
      date: "01/01/2025",
      subjectId: 1,
      plan: [],
    });
    expect(bad.success).toBe(false);
  });
});

describe("flattenErrors", () => {
  it("returns [] when valid", () => {
    expect(flattenErrors(bpmSchema.safeParse(100))).toEqual([]);
  });

  it("returns 'value: message' for top-level primitive errors", () => {
    const errs = flattenErrors(bpmSchema.safeParse(10));
    expect(errs).toContain("value: Number must be greater than or equal to 20");
  });

  it("returns 'field: message' for object property errors", () => {
    const schema = z.object({ title: z.string().min(5) });
    const errs = flattenErrors(schema.safeParse({ title: "abc" }));
    expect(errs).toContain("title: String must contain at least 5 character(s)");
  });

  it("returns 'a.b: message' for nested object errors", () => {
    const schema = z.object({
      nested: z.object({
        count: z.number().min(1),
      }),
    });
    const errs = flattenErrors(schema.safeParse({ nested: { count: 0 } }));
    expect(errs).toContain("nested.count: Number must be greater than or equal to 1");
  });

  it("returns multiple error messages when multiple validations fail", () => {
    const schema = z.object({
      a: z.number(),
      b: z.number(),
    });
    const errs = flattenErrors(schema.safeParse({ a: "not-a-number", b: "also-not" }));
    expect(errs).toHaveLength(2);
    expect(errs[0]).toMatch(/^a: /);
    expect(errs[1]).toMatch(/^b: /);
  });
});
