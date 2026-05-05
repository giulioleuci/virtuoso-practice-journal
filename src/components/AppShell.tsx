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
    { to: "/history", label: "History", icon: HistoryIcon },
    { to: "/profile", label: t("nav.profile"), icon: UserRound },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-8 pb-4 max-w-3xl w-full mx-auto">
        <h1 className="font-serif text-3xl text-foreground">{t("app.name")}</h1>
        <p className="text-sm text-muted-foreground italic mt-0.5">{t("app.tagline")}</p>
      </header>

      <main className="flex-1 px-6 pb-32 max-w-3xl w-full mx-auto animate-fade-in">
        <Outlet />
      </main>

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="paper-raised flex items-center gap-1 px-2 py-2">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[56px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
