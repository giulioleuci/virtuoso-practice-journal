import { useOutletContext } from "react-router-dom";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";

/**
 * Save/cancel bar that stays on screen. It sits where the app's other floating bars do: above the bottom navigation
 * and the Android system bar, on the system bar alone once the navigation hides (scroll, keyboard), above the
 * keyboard when it overlays the page, and beside the sidebar on wide screens. Put it inside the form: its buttons still submit it.
 */
export function FloatingActions({ children, className }: { children: React.ReactNode; className?: string }) {
  // Outside the app shell there is no outlet context: assume the navigation shows.
  const navHidden = (useOutletContext<{ navHidden?: boolean } | null>() ?? {}).navHidden === true;
  const keyboard = useKeyboardInset();
  const bottom = keyboard > 0 ? `${keyboard + 8}px` : navHidden ? "calc(12px + env(safe-area-inset-bottom))" : "calc(84px + env(safe-area-inset-bottom))";
  return (
    <div
      style={{ "--bar-bottom": bottom, "--keyboard-bottom": `${keyboard > 0 ? keyboard + 8 : 0}px` } as React.CSSProperties}
      className={cn(
        "fixed z-[60] flex items-center justify-end gap-2 rounded-[14px] border border-border bg-card p-3 shadow-raised transition-[bottom] duration-300 ease-out",
        "bottom-[var(--bar-bottom)] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))]",
        "min-[700px]:bottom-[max(calc(1.25rem+env(safe-area-inset-bottom)),var(--keyboard-bottom))] min-[700px]:left-[calc(195px+2rem)] min-[700px]:right-8 min-[1151px]:left-[calc(208px+2rem)] min-[1600px]:left-[calc(250px+2rem)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
