import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookMarked, CalendarDays, GraduationCap, History as HistoryIcon, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function AppShell() {
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
    <div className="min-h-screen flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-6 pt-8 pb-4 max-w-3xl w-full mx-auto">
        <h1 className="font-serif text-3xl text-foreground">{t("app.name")}</h1>
        <p className="text-sm text-muted-foreground italic mt-0.5">{t("app.tagline")}</p>
      </header>

      <main className="flex-1 px-6 pb-32 max-w-3xl w-full mx-auto animate-fade-in">
        <Outlet />
      </main>

      <nav
        className={cn(
          "fixed left-1/2 z-50 transition-all duration-300 ease-out",
          hidden ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          transform: hidden ? "translate(-50%, 140%)" : "translate(-50%, 0)",
        }}
      >
        <div className="paper-raised flex items-center gap-1 px-2 py-2">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )
              }
            >
              <Icon className="h-5 w-5 transition-transform" />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
