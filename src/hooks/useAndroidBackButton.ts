import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isAndroid, isNative } from "@/lib/platform";

const EXIT_PROMPT_WINDOW_MS = 2000;

/**
 * Wires the Android hardware back button to navigate browser history when
 * possible, and otherwise require a second press within 2s before exiting.
 * No-op outside of a native Android shell.
 */
export function useAndroidBackButton(exitPromptText: string): void {
  const lastPressRef = useRef(0);
  useEffect(() => {
    if (!isNative() || !isAndroid()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;

    (async () => {
      let App: typeof import("@capacitor/app").App;
      try {
        ({ App } = await import("@capacitor/app"));
      } catch {
        return;
      }
      if (cancelled) return;
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
          return;
        }
        const now = Date.now();
        if (now - lastPressRef.current < EXIT_PROMPT_WINDOW_MS) {
          App.exitApp();
          return;
        }
        lastPressRef.current = now;
        toast(exitPromptText, { duration: EXIT_PROMPT_WINDOW_MS });
      });
      if (cancelled) {
        handle.remove();
        return;
      }
      remove = () => handle.remove();
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [exitPromptText]);
}
