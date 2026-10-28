import { describe, it, expect } from "vitest";
import { getSubjectLayers, getSubjectLayerLabel } from "@/lib/domain/subjectLayers";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { Subject } from "@/domain/entities/common";
import { translate } from "@/lib/i18n";

const make = (over: Partial<Subject>): Subject => ({
  name: "S",
  type: "instrument",
  createdAt: 0,
  ...over,
});

describe("getSubjectLayers", () => {
  it("uses the theory subject's configured aspects", () => {
    expect(getSubjectLayers(make({ type: "theory", layers: ["Contesto storico", "Ascolto"] }))).toEqual(["Contesto storico", "Ascolto"]);
  });

  it("keeps an explicitly empty theory configuration", () => {
    expect(getSubjectLayers(make({ type: "theory", layers: [] }))).toEqual([]);
  });

  it("defaults to the existing theory aspects only when not configured", () => {
    expect(getSubjectLayers(make({ type: "theory" }))).toEqual([...THEORY_LAYERS]);
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

it("translates built-in theory aspects and preserves custom or practical names", () => {
  const t = (key: string) => translate("it", key);
  const theory = make({ type: "theory" });
  expect(getSubjectLayerLabel(theory, "analytical", t)).toBe("Analitico");
  expect(getSubjectLayerLabel(theory, "Contesto storico", t)).toBe("Contesto storico");
  expect(getSubjectLayerLabel(make({}), "reading", t)).toBe("reading");
});
