import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Profile } from "@/domain/entities/profile";
import { useReminderSchedule } from "./useReminderSchedule";

const platform = vi.hoisted(() => ({ scheduleReminders: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/platform", () => platform);
vi.mock("@/lib/reminderPresets", () => ({ resolveReminderText: () => Promise.resolve({ title: "Practice", body: "Time to play" }) }));
afterEach(() => platform.scheduleReminders.mockClear());

it("schedules the reminder chosen at onboarding without visiting settings", async () => {
  renderHook(() => useReminderSchedule({ reminderEnabled: true, reminderFreq: "weekdays", reminderTime: "18:00" } as Profile, "en"));
  await waitFor(() => expect(platform.scheduleReminders).toHaveBeenCalledWith({ time: "18:00", days: [1, 2, 3, 4, 5], title: "Practice", body: "Time to play" }));
});

it("clears scheduled reminders when they are turned off", async () => {
  renderHook(() => useReminderSchedule({ reminderEnabled: false } as Profile, "en"));
  await waitFor(() => expect(platform.scheduleReminders).toHaveBeenCalledWith(null));
});
