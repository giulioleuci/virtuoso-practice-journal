import { describe, it, expect } from "vitest";
import { getSubjectLayers } from "@/lib/domain/subjectLayers";
import { THEORY_LAYERS, type Subject } from "@/lib/db";

const make = (over: Partial<Subject>): Subject => ({
  name: "S",
  type: "instrument",
  createdAt: 0,
  ...over,
});

describe("getSubjectLayers", () => {
  it("returns the fixed theory layers for theory subjects", () => {
    expect(getSubjectLayers(make({ type: "theory", layers: ["ignored"] }))).toEqual([...THEORY_LAYERS]);
  });

  it("returns the subject's own layers for non-theory subjects", () => {
    expect(getSubjectLayers(make({ type: "instrument", layers: ["a", "b"] }))).toEqual(["a", "b"]);
  });

  it("returns an empty array for missing layers or undefined subject", () => {
    expect(getSubjectLayers(make({ type: "instrument", layers: undefined }))).toEqual([]);
    expect(getSubjectLayers(undefined)).toEqual([]);
    expect(getSubjectLayers(null)).toEqual([]);
  });
});
