import { useEffect, useState } from "react";

/**
 * Reports the height of the on-screen keyboard in CSS pixels.
 *
 * Uses VisualViewport when available (Android Chrome WebView, modern browsers,
 * Capacitor when KeyboardResize is set to "none"). Returns 0 when there's no
 * keyboard, or when the API is unsupported.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      // Difference between layout viewport and visual viewport gives keyboard height
      const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Treat tiny diffs (URL bar) as zero
      setInset(diff > 80 ? diff : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
