import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useScheduleTopUp } from "./useScheduleTopUp";

const commands = vi.hoisted(() => ({ applicationCommands: { schedule: { extend: vi.fn(() => Promise.resolve()) } } }));
vi.mock("@/lib/applicationCommands", () => commands);

it("tops the schedule up on mount and when the app becomes visible again", () => {
  renderHook(() => useScheduleTopUp());
  expect(commands.applicationCommands.schedule.extend).toHaveBeenCalledTimes(1);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(commands.applicationCommands.schedule.extend).toHaveBeenCalledTimes(2);
});
