import { describe, it, expect } from "vitest";
import { computeStreak, daysFromSessions, computeStreakFromSessions } from "@/lib/domain/streak";

describe("computeStreak", () => {
  const from = new Date(2026, 4, 26); // Tue 2026-05-26

  it("counts back from today", () => {
    const days = new Set(["2026-05-24", "2026-05-25", "2026-05-26"]);
    expect(computeStreak(days, from)).toEqual({ streak: 3, best: 3 });
  });

  it("allows a streak ending yesterday when today has no session", () => {
    const days = new Set(["2026-05-24", "2026-05-25"]);
    expect(computeStreak(days, from).streak).toBe(2);
  });

  it("returns zero current streak when there's a gap", () => {
    const days = new Set(["2026-05-20", "2026-05-21"]);
    expect(computeStreak(days, from).streak).toBe(0);
  });

  it("computes best streak across history", () => {
    const days = new Set([
      "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", // best run of 4
      "2026-05-10",
      "2026-05-25", "2026-05-26", // current run of 2
    ]);
    const res = computeStreak(days, from);
    expect(res.streak).toBe(2);
    expect(res.best).toBe(4);
  });

  it("handles empty input", () => {
    expect(computeStreak(new Set(), from)).toEqual({ streak: 0, best: 0 });
  });

  it("daysFromSessions + computeStreakFromSessions agree", () => {
    const sessions = [{ date: "2026-05-25" }, { date: "2026-05-26" }, { date: "2026-05-26" }];
    expect(daysFromSessions(sessions).size).toBe(2);
    expect(computeStreakFromSessions(sessions, from).streak).toBe(2);
  });
});
