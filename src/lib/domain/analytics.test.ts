import { describe, it, expect } from "vitest";
import { weeklySessionCounts } from "@/lib/domain/analytics";

describe("weeklySessionCounts", () => {
  it("buckets sessions by Mon-Sun week and sorts chronologically", () => {
    const sessions = [
      { date: "2026-05-25" }, // Mon (week A)
      { date: "2026-05-26" }, // Tue (week A)
      { date: "2026-05-31" }, // Sun (week A)
      { date: "2026-06-01" }, // Mon (week B)
    ];
    expect(weeklySessionCounts(sessions)).toEqual([
      { weekKey: "2026-05-25", count: 3 },
      { weekKey: "2026-06-01", count: 1 },
    ]);
  });

  it("keeps only the most recent N weeks when limit is set", () => {
    const sessions = [
      { date: "2026-05-04" },
      { date: "2026-05-11" },
      { date: "2026-05-18" },
    ];
    const res = weeklySessionCounts(sessions, 2);
    expect(res.map((w) => w.weekKey)).toEqual(["2026-05-11", "2026-05-18"]);
  });

  it("returns an empty array for no sessions", () => {
    expect(weeklySessionCounts([])).toEqual([]);
  });
});
