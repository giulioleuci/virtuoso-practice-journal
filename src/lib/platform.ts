/**
 * Platform abstraction layer.
 *
 * Hides whether we're running as a Capacitor native app, an installed PWA,
 * or a regular browser. Each helper falls back gracefully when the Capacitor
 * plugin isn't available, so the same code paths work in tests and the dev
 * server.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): string => Capacitor.getPlatform();
export const isAndroid = (): boolean => Capacitor.getPlatform() === "android";

/** Initialize platform UI plumbing: status bar, keyboard insets. Idempotent. */
export async function configurePlatform(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    // We use edgeToEdge: true in capacitor.config.ts and rely on safe-area-inset
    // CSS env vars to push content below the status bar.
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  } catch {
    /* status bar plugin missing — ignore */
  }
  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    // "none" lets us handle the keyboard ourselves via visualViewport; this
    // keeps the bottom nav and content stable instead of having the WebView
    // squish under us. The `useKeyboardInset` hook exposes the live offset.
    await Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => undefined);
    await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined);
  } catch {
    /* keyboard plugin missing — ignore */
  }
}

// ---------------------------------------------------------------------------
// Local notifications (practice reminders)
// ---------------------------------------------------------------------------

export interface ReminderSchedule {
  /** "HH:MM" 24h format. */
  time: string;
  /** Days of week 0..6 (0 = Sun). Empty = every day. */
  days: number[];
  /** Optional title/body overrides. */
  title?: string;
  body?: string;
}

const REMINDER_ID_BASE = 1000;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const cur = await LocalNotifications.checkPermissions();
      if (cur.display === "granted") return true;
      const req = await LocalNotifications.requestPermissions();
      return req.display === "granted";
    } catch {
      return false;
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export async function scheduleReminders(schedule: ReminderSchedule | null): Promise<void> {
  if (!isNative()) return; // web notifications can't be scheduled cross-session
  let mod: typeof import("@capacitor/local-notifications");
  try {
    mod = await import("@capacitor/local-notifications");
  } catch {
    return;
  }
  const { LocalNotifications } = mod;
  // Always clear any prior schedule before re-arming.
  const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
  const toCancel = pending.notifications.filter((n) => n.id >= REMINDER_ID_BASE && n.id < REMINDER_ID_BASE + 100);
  if (toCancel.length) {
    await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) }).catch(() => undefined);
  }
  if (!schedule) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const [hh, mm] = schedule.time.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;
  const days = schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
  const items = days.map((d, idx) => ({
    id: REMINDER_ID_BASE + idx,
    title: schedule.title ?? "Virtuoso",
    body: schedule.body ?? "Time to practice.",
    // Capacitor weekdays are 1..7 (Sun = 1)
    schedule: {
      on: { weekday: d + 1, hour: hh, minute: mm, second: 0 },
      allowWhileIdle: true,
    },
    smallIcon: "ic_stat_icon",
  }));
  await LocalNotifications.schedule({ notifications: items }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// File save / share (export backup)
// ---------------------------------------------------------------------------

/** Save text content to a file, returning a user-readable indicator of where. */
export async function saveTextFile(filename: string, content: string, mime = "application/json"): Promise<"download" | "shared" | "saved"> {
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      try {
        const { Share } = await import("@capacitor/share");
        const uri = await Filesystem.getUri({ path: filename, directory: Directory.Documents });
        await Share.share({ title: filename, url: uri.uri, dialogTitle: "Save backup" });
        return "shared";
      } catch {
        return "saved";
      }
    } catch {
      // fall through to web download
    }
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "download";
}

/** Open a file picker and return its text contents. */
export async function pickTextFile(accept = "application/json"): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await file.text());
      } catch {
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
