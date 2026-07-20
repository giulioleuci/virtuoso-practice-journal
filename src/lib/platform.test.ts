import { describe, it, expect, vi, afterEach } from "vitest";

import {
  isNative,
  ensureNotificationPermission,
  scheduleReminders,
} from "./platform";

describe("platform.isNative", () => {
  it("returns false in the test environment", () => {
    expect(isNative()).toBe(false);
  });
});

describe("platform.scheduleReminders", () => {
  it("is a no-op on the web (returns without throwing)", async () => {
    await expect(scheduleReminders({ time: "18:00", days: [] })).resolves.toBeUndefined();
    await expect(scheduleReminders(null)).resolves.toBeUndefined();
  });
});

describe("platform.ensureNotificationPermission", () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification;

  afterEach(() => {
    if (originalNotification !== undefined) {
      (globalThis as { Notification?: unknown }).Notification = originalNotification;
    } else {
      delete (globalThis as { Notification?: unknown }).Notification;
    }
  });

  it("returns false when the browser does not support Notifications", async () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    expect(await ensureNotificationPermission()).toBe(false);
  });

  it("returns true when permission is already granted", async () => {
    const requestPermission = vi.fn();
    (globalThis as Record<string, unknown>).Notification = Object.assign(
      function MockNotification() { /* noop */ } as unknown as typeof Notification,
      { permission: "granted", requestPermission }
    );
    expect(await ensureNotificationPermission()).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("returns false when permission is denied", async () => {
    (globalThis as Record<string, unknown>).Notification = Object.assign(
      function MockNotification() { /* noop */ } as unknown as typeof Notification,
      { permission: "denied", requestPermission: vi.fn() }
    );
    expect(await ensureNotificationPermission()).toBe(false);
  });

  it("requests permission when undecided", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    (globalThis as Record<string, unknown>).Notification = Object.assign(
      function MockNotification() { /* noop */ } as unknown as typeof Notification,
      { permission: "default", requestPermission }
    );
    expect(await ensureNotificationPermission()).toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});
