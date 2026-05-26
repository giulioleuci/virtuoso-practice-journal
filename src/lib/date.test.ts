import { describe, it, expect } from "vitest";
import {
  dayKey,
  today,
  parseDayKey,
  addDays,
  startOfWeek,
  endOfWeek,
  weekKey,
  weekKeyOf,
} from "@/lib/date";

describe("date helpers", () => {
  it("dayKey formats local Y-M-D with zero padding", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("today returns a dayKey for now", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today()).toBe(dayKey(new Date()));
  });

  it("parseDayKey round-trips with dayKey", () => {
    const d = parseDayKey("2026-05-26");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(26);
    expect(dayKey(d)).toBe("2026-05-26");
  });

  it("addDays does not mutate and crosses month boundaries", () => {
    const base = parseDayKey("2026-01-31");
    const next = addDays(base, 1);
    expect(dayKey(next)).toBe("2026-02-01");
    expect(dayKey(base)).toBe("2026-01-31");
    expect(dayKey(addDays(parseDayKey("2026-03-01"), -1))).toBe("2026-02-28");
  });

  it("startOfWeek returns Monday, endOfWeek returns Sunday", () => {
    // 2026-05-26 is a Tuesday
    expect(dayKey(startOfWeek(parseDayKey("2026-05-26")))).toBe("2026-05-25");
    expect(dayKey(endOfWeek(parseDayKey("2026-05-26")))).toBe("2026-05-31");
    // Sunday belongs to the week that started the previous Monday
    expect(dayKey(startOfWeek(parseDayKey("2026-05-31")))).toBe("2026-05-25");
  });

  it("weekKey is stable within a Mon-Sun week and differs across weeks", () => {
    expect(weekKeyOf("2026-05-25")).toBe(weekKeyOf("2026-05-31"));
    expect(weekKeyOf("2026-05-25")).not.toBe(weekKeyOf("2026-06-01"));
    expect(weekKey(parseDayKey("2026-05-26"))).toBe("2026-05-25");
  });

  it("boundary: a late-evening local time still maps to its local day", () => {
    const lateTuesday = new Date(2026, 4, 26, 23, 30);
    expect(dayKey(lateTuesday)).toBe("2026-05-26");
    expect(weekKey(lateTuesday)).toBe("2026-05-25");
  });
});
