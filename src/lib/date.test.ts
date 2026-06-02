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
  formatDate,
  formatRelativeDate,
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

  it("startOfWeek / endOfWeek respects weekStartsOn", () => {
    // 2026-05-26 is a Tuesday
    const tuesday = parseDayKey("2026-05-26");

    // Default (Monday)
    expect(dayKey(startOfWeek(tuesday))).toBe("2026-05-25");
    expect(dayKey(endOfWeek(tuesday))).toBe("2026-05-31");

    // Sunday start
    expect(dayKey(startOfWeek(tuesday, 0))).toBe("2026-05-24");
    expect(dayKey(endOfWeek(tuesday, 0))).toBe("2026-05-30");

    // Saturday start
    expect(dayKey(startOfWeek(tuesday, 6))).toBe("2026-05-23");
    expect(dayKey(endOfWeek(tuesday, 6))).toBe("2026-05-29");
  });

  it("weekKey is stable within a week and differs across weeks", () => {
    // Monday start
    expect(weekKeyOf("2026-05-25", 1)).toBe(weekKeyOf("2026-05-31", 1));
    expect(weekKeyOf("2026-05-25", 1)).not.toBe(weekKeyOf("2026-06-01", 1));

    // Sunday start
    expect(weekKeyOf("2026-05-24", 0)).toBe(weekKeyOf("2026-05-30", 0));
    expect(weekKeyOf("2026-05-24", 0)).not.toBe(weekKeyOf("2026-05-31", 0));
  });

  it("boundary: a late-evening local time still maps to its local day", () => {
    const lateTuesday = new Date(2026, 4, 26, 23, 30);
    expect(dayKey(lateTuesday)).toBe("2026-05-26");
    expect(weekKey(lateTuesday)).toBe("2026-05-25");
  });

  describe("formatDate locales", () => {
    const d = "2026-05-26"; // Tuesday

    it("formats en-US correctly", () => {
      expect(formatDate(d, "en", "short")).toBe("05/26/2026");
      expect(formatDate(d, "en", "medium")).toBe("May 26, 2026");
      expect(formatDate(d, "en", "long")).toBe("Tuesday, May 26, 2026");
    });

    it("formats it-IT correctly", () => {
      expect(formatDate(d, "it", "short")).toBe("26/05/2026");
      expect(formatDate(d, "it", "medium")).toBe("26 mag 2026");
      expect(formatDate(d, "it", "long")).toBe("martedì 26 maggio 2026");
    });

    it("formats es-ES correctly", () => {
      expect(formatDate(d, "es", "short")).toBe("26/05/2026");
      expect(formatDate(d, "es", "medium")).toBe("26 may 2026");
      expect(formatDate(d, "es", "long")).toBe("martes, 26 de mayo de 2026");
    });

    it("formats de-DE correctly", () => {
      expect(formatDate(d, "de", "short")).toBe("26.05.2026");
      expect(formatDate(d, "de", "medium")).toBe("26. Mai 2026");
      expect(formatDate(d, "de", "long")).toBe("Dienstag, 26. Mai 2026");
    });
  });

  describe("relative formatting", () => {
    const t = today();

    it("formats today/yesterday/tomorrow across languages", () => {
      const yesterday = dayKey(addDays(parseDayKey(t), -1));
      const tomorrow = dayKey(addDays(parseDayKey(t), 1));

      expect(formatRelativeDate(t, "en")).toBe("today");
      expect(formatRelativeDate(yesterday, "en")).toBe("yesterday");
      expect(formatRelativeDate(tomorrow, "en")).toBe("tomorrow");

      expect(formatRelativeDate(t, "it")).toBe("oggi");
      expect(formatRelativeDate(yesterday, "it")).toBe("ieri");
      expect(formatRelativeDate(tomorrow, "it")).toBe("domani");
    });

    it("formats 2-3 days offset", () => {
      const in3 = dayKey(addDays(parseDayKey(t), 3));
      const ago3 = dayKey(addDays(parseDayKey(t), -3));

      expect(formatRelativeDate(in3, "en")).toBe("in 3 days");
      expect(formatRelativeDate(ago3, "en")).toBe("3 days ago");
    });

    it("returns null beyond 3 days", () => {
      const in4 = dayKey(addDays(parseDayKey(t), 4));
      expect(formatRelativeDate(in4, "en")).toBeNull();
    });

    it("formatDate uses relative when requested", () => {
      expect(formatDate(t, "en", "short", true)).toBe("today");
      // Far date does NOT use relative
      expect(formatDate("2020-01-01", "en", "short", true)).toBe("01/01/2020");
    });
  });
});
