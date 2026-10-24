import { describe, expect, it } from "vitest";
import type { Profile } from "@/domain/entities/profile";
import type { Task } from "@/domain/entities/task";
import { planAlerts } from "./taskAlerts";

const profile = { alertTime: "09:00" } as Profile;
const task = (date: string, extra: Partial<Task> = {}): Task => ({ date, subjectId: 1, title: "t", plan: [], done: false, createdAt: 1, ...extra });
const now = new Date("2026-10-21T08:00:00"); // Wednesday

describe("planAlerts", () => {
  it("alerts on days with open recurring tasks, on the chosen weekdays only", () => {
    const tasks = [task("2026-10-21", { recurrenceTaskId: 1 }), task("2026-10-22", { recurrenceTaskId: 1 }), task("2026-10-23", { recurrenceTaskId: 1, done: true }), task("2026-10-24")];
    const all = planAlerts({ ...profile, missedAlertEnabled: false }, tasks, [], now);
    expect(all.map((a) => [a.at.getDate(), a.count])).toEqual([[21, 1], [22, 1]]);
    const thursday = planAlerts({ ...profile, missedAlertEnabled: false, recurringAlertDays: [4] }, tasks, [], now);
    expect(thursday.map((a) => a.at.getDate())).toEqual([22]);
    expect(planAlerts({ ...profile, recurringAlertEnabled: false, missedAlertEnabled: false }, tasks, [], now)).toEqual([]);
  });

  it("skips an alert time that already passed today", () => {
    expect(planAlerts({ ...profile, alertTime: "07:00", missedAlertEnabled: false }, [task("2026-10-21", { recurrenceTaskId: 1 })], [], now)).toEqual([]);
  });

  it("alerts once N planned days in a row went unpracticed, ignoring days without a plan", () => {
    const tasks = [task("2026-10-20"), task("2026-10-18"), task("2026-10-17")];
    const only = { ...profile, recurringAlertEnabled: false, missedAlertAfter: 3 };
    expect(planAlerts(only, tasks, [], now)).toMatchObject([{ kind: "missed", count: 3 }]);
    expect(planAlerts({ ...only, missedAlertAfter: 4 }, tasks, [], now)).toEqual([]);
    expect(planAlerts(only, tasks, [{ date: "2026-10-18" }], now)).toEqual([]);
    expect(planAlerts(only, tasks, [{ date: "2026-10-21" }], now)).toEqual([]);
  });
});
