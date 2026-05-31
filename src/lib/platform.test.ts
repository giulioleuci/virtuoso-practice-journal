import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// platform.ts re-exports Capacitor helpers; in tests Capacitor reports the
// "web" platform, so isNative() is false and the helpers exercise the web path.
import {
  isNative,
  ensureNotificationPermission,
  scheduleReminders,
  saveTextFile,
  pickTextFile,
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

describe("platform.saveTextFile (web fallback)", () => {
  let clickedAnchor: HTMLAnchorElement | null = null;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    clickedAnchor = null;
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string, opts?: ElementCreationOptions) => {
      const el = originalCreateElement(tag, opts);
      if (tag === "a") {
        el.click = vi.fn(() => { clickedAnchor = el as HTMLAnchorElement; });
      }
      return el;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it("creates an anchor, triggers download, and revokes the blob URL", async () => {
    const result = await saveTextFile("backup.json", '{"a":1}');
    expect(result).toBe("download");
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(clickedAnchor).not.toBeNull();
    expect(clickedAnchor!.download).toBe("backup.json");
    expect(clickedAnchor!.href).toContain("blob:test");
  });
});

describe("platform.pickTextFile", () => {
  const originalCreateElement = document.createElement.bind(document);
  let createdInput: HTMLInputElement | null = null;

  beforeEach(() => {
    createdInput = null;
    vi.spyOn(document, "createElement").mockImplementation((tag: string, opts?: ElementCreationOptions) => {
      const el = originalCreateElement(tag, opts);
      if (tag === "input") {
        // Suppress the actual file picker UI in tests
        el.click = vi.fn();
        createdInput = el as HTMLInputElement;
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the picked file's contents on selection", async () => {
    const promise = pickTextFile();
    // jsdom lacks File.prototype.text, so build a stand-in
    const file = { text: () => Promise.resolve('{"a":1}') } as unknown as File;
    Object.defineProperty(createdInput!, "files", { value: [file], configurable: true });
    await createdInput!.onchange?.(new Event("change"));
    await expect(promise).resolves.toBe('{"a":1}');
  });

  it("resolves null when the user cancels (oncancel)", async () => {
    const promise = pickTextFile();
    createdInput!.oncancel?.(new Event("cancel"));
    await expect(promise).resolves.toBeNull();
  });

  it("resolves null via the focus fallback if no file is chosen", async () => {
    vi.useFakeTimers();
    try {
      const promise = pickTextFile();
      // Simulate window regaining focus with no file selected
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(350);
      await expect(promise).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("focus fallback does NOT clobber a real selection", async () => {
    vi.useFakeTimers();
    try {
      const promise = pickTextFile();
      const file = { text: () => Promise.resolve('{"a":2}') } as unknown as File;
      Object.defineProperty(createdInput!, "files", { value: [file], configurable: true });
      await createdInput!.onchange?.(new Event("change"));
      // Focus fires later after the change handler resolved
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(350);
      await expect(promise).resolves.toBe('{"a":2}');
    } finally {
      vi.useRealTimers();
    }
  });
});
