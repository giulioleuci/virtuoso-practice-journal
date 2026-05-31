import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BookMarked, CalendarDays, GraduationCap, History as HistoryIcon, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/db";

export default function AppShell({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const location = useLocation();
  // Use the top-level route segment as the transition key so navigating between
  // primary sections fades, but in-page state changes (query/search params,
  // nested routes) don't replay the animation.
  const pageKey = "/" + (location.pathname.split("/")[1] ?? "");
  const items = [
    { to: "/", label: t("nav.diary"), icon: CalendarDays, end: true },
    { to: "/library", label: t("nav.library"), icon: BookMarked },
    { to: "/lessons", label: t("nav.lessons"), icon: GraduationCap },
    { to: "/history", label: t("nav.history"), icon: HistoryIcon },
    { to: "/profile", label: t("nav.profile"), icon: UserRound },
  ];

  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const keyboardInset = useKeyboardInset();
  const navHidden = hidden || keyboardInset > 0;

  useAndroidBackButton(t("toast.pressBackAgainToExit"));

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 80) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <main
        className="flex-1 px-4 sm:px-6 max-w-3xl w-full mx-auto"
        style={{
          paddingTop: "calc(1rem + env(safe-area-inset-top))",
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
        }}
      >
        <div key={pageKey} className="animate-fade-in">
          <Outlet context={{ profile }} />
        </div>
      </main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out",
          "border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          navHidden ? "translate-y-full" : "translate-y-0"
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-hidden={navHidden}
      >
        <div className="max-w-3xl mx-auto flex items-stretch justify-between px-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground active:bg-accent/40"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute top-0 h-0.5 rounded-full bg-primary transition-all duration-300 ease-out",
                      isActive ? "w-8 opacity-100" : "w-0 opacity-0"
                    )}
                  />
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-transform duration-300 ease-out",
                      isActive ? "scale-110" : ""
                    )}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span className={cn("text-[10px] font-medium tracking-wide leading-none", isActive && "font-semibold")}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
