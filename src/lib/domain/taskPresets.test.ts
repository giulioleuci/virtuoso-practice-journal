import { describe, expect, it } from "vitest";
import { expandTaskRecurrence } from "@/lib/recurrence";
import { presetRecurrence, resolveWhen } from "./taskPresets";

describe("taskPresets", () => {
  it("none has no recurrence", () => expect(presetRecurrence("none", "2026-10-14")).toBeUndefined());
  it("weekdays expands Mon-Fri only until the school year end", () => {
    const dates = expandTaskRecurrence(presetRecurrence("weekdays", "2026-10-14")!);
    expect(dates[0]).toBe("2026-10-14");
    expect(dates.at(-1)! <= "2027-06-30").toBe(true);
    expect(dates.every((d) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay()))).toBe(true);
  });
  it("mwf and every2 follow their pattern", () => {
    const mwf = expandTaskRecurrence(presetRecurrence("mwf", "2026-10-14")!).slice(0, 3);
    expect(mwf).toEqual(["2026-10-14", "2026-10-16", "2026-10-19"]);
    const e2 = expandTaskRecurrence(presetRecurrence("every2", "2026-10-14")!).slice(0, 2);
    expect(e2).toEqual(["2026-10-14", "2026-10-16"]);
  });
  it("a July start keeps the end open instead of producing no dates", () => {
    expect(expandTaskRecurrence(presetRecurrence("daily", "2026-07-15")!).length).toBeGreaterThan(0);
  });
  it("custom date is used only for custom", () => expect(resolveWhen("custom", "2026-11-01")).toBe("2026-11-01"));
});
