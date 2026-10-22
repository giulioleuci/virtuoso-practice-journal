import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NOTE_VALUES } from "@/domain/constants/noteValues";
import { sessionInputSchema, taskInputSchema, flattenErrors, bpmSchema, libraryKindSchema, collectionKindSchema, libraryItemInputSchema, segmentInputSchema, collectionLinkInputSchema } from "./schemas";

describe("study materials", () => {
  it("accepts the five autonomous types and rejects material kinds as containers", () => {
    expect(libraryKindSchema.options).toEqual(["piece", "study", "technique", "exercise", "theory"]);
    expect(collectionKindSchema.safeParse("piece").success).toBe(false);
    expect(collectionKindSchema.safeParse("manual").success).toBe(true);
    expect(libraryItemInputSchema.parse({ studyStatus: "consolidated", subjectId: 1, kind: "study", title: " Study " })).toEqual({ subjectId: 1, kind: "study", title: "Study" });
    expect(libraryItemInputSchema.safeParse({ studyStatus: "not_started", subjectId: 1, kind: "study", title: " " }).success).toBe(false);
  });

  it("requires complete optional tempo pairs on materials and segments", () => {
    const item = { studyStatus: "not_started", subjectId: 1, kind: "exercise", title: "Reading" };
    const segment = { label: "A", position: 0, layers: [] };
    for (const [schema, input] of [[libraryItemInputSchema, item], [segmentInputSchema, segment]] as const) {
      expect(schema.safeParse(input).success).toBe(true);
      expect(schema.safeParse({ ...input, targetBpm: 80 }).success).toBe(false);
      expect(schema.safeParse({ ...input, noteVal: "quarter" }).success).toBe(false);
      expect(schema.safeParse({ ...input, targetBpm: 80, noteVal: "quarter" }).success).toBe(true);
    }
  });

  it("validates bar ranges including pickup and single bars", () => {
    const segment = { label: "A", position: 0, layers: [] };
    for (const [barStart, barEnd] of [[0, 8], [8, 8]]) expect(segmentInputSchema.safeParse({ ...segment, barStart, barEnd }).success).toBe(true);
    for (const patch of [{ barStart: 9, barEnd: 8 }, { barStart: 1 }, { barEnd: 2 }, { barStart: -1, barEnd: 2 }, { barStart: 1.5, barEnd: 3 }, { position: -1 }, { label: " " }]) {
      expect(segmentInputSchema.safeParse({ ...segment, ...patch }).success).toBe(false);
    }
  });

  it("allows a single page but requires ordered positive page ranges", () => {
    expect(collectionLinkInputSchema.safeParse({ pageStart: 3 }).success).toBe(true);
    expect(collectionLinkInputSchema.safeParse({ reference: "Exercise 37", pageStart: 3, pageEnd: 4 }).success).toBe(true);
    for (const input of [{ pageStart: 4, pageEnd: 3 }, { pageEnd: 4 }, { pageStart: 0 }, { pageStart: 1.5 }]) expect(collectionLinkInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("bpmSchema", () => {
  it("accepts in-range integers", () => {
    for (const bpm of [1, 10, 120, 400]) expect(bpmSchema.safeParse(bpm).success).toBe(true);
  });
  it("rejects out-of-range", () => {
    for (const bpm of [0, 401, NaN, 1.5]) expect(bpmSchema.safeParse(bpm).success).toBe(false);
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
    const errs = flattenErrors(bpmSchema.safeParse(0));
    expect(errs).toContain("value: Number must be greater than or equal to 1");
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
