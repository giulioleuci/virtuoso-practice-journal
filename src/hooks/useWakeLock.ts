import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `enabled` is true (practice with the instrument
 * in hand). No-ops when the Screen Wake Lock API is unavailable.
 */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const request = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
        if (!wakeLock) return;
        const sentinel = await wakeLock.request("screen");
        if (cancelled) { await sentinel.release(); return; }
        lockRef.current = sentinel;
      } catch {
        /* denied or unsupported — practice continues without the lock */
      }
    };

    const onVisibility = () => {
      // The browser releases the lock whenever the page hides; take a new one on return.
      if (document.visibilityState === "visible" && (!lockRef.current || lockRef.current.released)) void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lockRef.current?.release().catch(() => undefined);
      lockRef.current = null;
    };
  }, [enabled]);
}
