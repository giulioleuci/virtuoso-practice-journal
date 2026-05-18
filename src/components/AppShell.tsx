import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookMarked, CalendarDays, GraduationCap, History as HistoryIcon, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/db";

export default function AppShell({ profile }: { profile: Profile }) {
  const { t } = useI18n();
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
        className="flex-1 px-6 max-w-3xl w-full mx-auto"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
        }}
      >
        <Outlet context={{ profile }} />
      </main>

      <nav
        className={cn(
          "fixed left-1/2 z-50 transition-all duration-300 ease-out",
          navHidden ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          transform: navHidden ? "translate(-50%, 140%)" : "translate(-50%, 0)",
        }}
        aria-hidden={navHidden}
      >
        <div className="paper-raised flex items-center gap-1 px-2 py-2">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-300 ease-out min-w-[56px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft scale-[1.06]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-95"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-300 ease-out",
                      isActive ? "-translate-y-0.5 scale-110" : "group-hover:-translate-y-0.5"
                    )}
                  />
                  <span className="text-[11px] font-medium">{label}</span>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 h-1 rounded-full bg-primary-foreground/80 transition-all duration-300 ease-out",
                      isActive ? "w-5 opacity-100" : "w-0 opacity-0"
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
