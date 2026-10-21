import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BarChart3, BookMarked, CalendarDays, GraduationCap, ListChecks, MoreHorizontal, Printer, Settings, Shapes } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useReminderSchedule } from "@/hooks/useReminderSchedule";
import { useActiveTasks, useAssignments } from "@/presentation/hooks/useEntities";
import { assignmentsToPlan } from "@/presentation/utils/assignments";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Profile } from "@/domain/entities/profile";

const WIDE_PAGES = ["/", "/tasks", "/library", "/lessons", "/analytics", "/history", "/profile", "/log", "/sessions"];
const SIDEBAR_W = "min-[700px]:ml-[195px] min-[1151px]:ml-[208px] min-[1600px]:ml-[250px]";

export default function AppShell({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();
  const location = useLocation();
  const pageKey = "/" + (location.pathname.split("/")[1] ?? "");
  const pendingHomework = assignmentsToPlan(useAssignments(), useActiveTasks()).length;
  const items = [
    { to: "/", label: t("nav.today"), icon: CalendarDays, also: ["/log"] },
    { to: "/tasks", label: t("nav.plan"), short: t("nav.planShort"), icon: ListChecks },
    { to: "/library", label: t("nav.library"), icon: BookMarked },
    { to: "/lessons", label: t("nav.lessons"), icon: GraduationCap, badge: pendingHomework },
    { to: "/analytics", label: t("nav.progress"), icon: BarChart3, also: ["/history", "/sessions"] },
  ];
  const secondary = [
    { to: "/study-setup", label: t("nav.studySetup"), icon: Shapes },
    { to: "/print/weekly", label: t("nav.weeklySummary"), icon: Printer },
    { to: "/profile", label: t("nav.settings"), icon: Settings },
  ];
  const [today, plan, library, lessons, progress] = items;
  const mobileItems = [plan, lessons, today, library];
  const moreItems: typeof items = [progress, ...secondary];
  const isActive = (to: string, also: string[] = []) =>
    [to, ...also].some((p) => (p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)));
  const moreActive = moreItems.some((m) => isActive(m.to, m.also));

  const [hidden, setHidden] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const lastY = useRef(0);
  const main = useRef<HTMLElement>(null);
  const keyboardInset = useKeyboardInset();
  // Forms keep their save bar pinned low: no navigation beside Save while logging or planning.
  const onForm = ["/log", "/tasks/new", "/tasks/edit/", "/tasks/bulk", "/lessons/live"].some((p) => p.endsWith("/") ? location.pathname.startsWith(p) : location.pathname === p);
  const navHidden = hidden || keyboardInset > 0 || onForm;

  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    const destination = items.find(item => isActive(item.to, item.also)) ?? secondary.find(item => isActive(item.to));
    const title = main.current?.querySelector("h1")?.textContent ?? destination?.label ?? t("app.name");
    document.title = `${title} · Virtuoso`;
  // Only route arrivals move focus; filters, hashes and live data keep the current control.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useAndroidBackButton(t("toast.pressBackAgainToExit"));
  useReminderSchedule(profile, lang);

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

  const mobileLink = (active: boolean) =>
    cn(
      "relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-2 pt-3 text-xs transition-colors",
      active ? "text-primary font-semibold" : "text-muted-foreground active:text-foreground"
    );

  return (
    <div
      className="app-shell min-h-screen"
      style={{
        "--navigation-height": navHidden ? "0px" : undefined,
        "--keyboard-inset": `${keyboardInset}px`,
      } as CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        {t("nav.skipToContent")}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[195px] flex-col border-r border-border bg-background px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.75rem+env(safe-area-inset-top))] min-[700px]:flex min-[1151px]:w-[208px] min-[1151px]:px-5 min-[1600px]:w-[250px]">
        <Link to="/" className="mb-9 ml-2.5 flex items-center gap-2.5 font-serif text-[1.75rem] font-semibold tracking-tight min-[1151px]:text-[2rem]">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="h-8 w-8 rounded-lg" />
          Virtuoso
        </Link>
        <nav aria-label={t("nav.main")} className="grid gap-1.5">
          {items.map(({ to, label, icon: Icon, badge, also }) => {
            const active = isActive(to, also);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[46px] items-center gap-3 rounded-lg px-2.5 py-3 text-[0.8125rem] font-medium transition-colors min-[1151px]:px-3.5 min-[1151px]:text-sm",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                {label}
                {!!badge && (
                  <>
                    <span aria-hidden className="ml-auto min-w-5 rounded bg-primary px-1.5 py-px text-center font-numeric text-xs font-semibold text-primary-foreground">
                      {badge}
                    </span>
                    <span className="sr-only">{t("diary.homework", { count: badge })}</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-1.5">
          {secondary.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActive(to) ? "page" : undefined}
              className={cn(
                "flex min-h-[46px] items-center gap-3 rounded-lg px-2.5 py-3 text-[0.8125rem] font-medium transition-colors min-[1151px]:px-3.5",
                isActive(to) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
          <div className="mt-3 flex items-center gap-2.5 px-2.5 pt-4 text-xs text-muted-foreground">
            <span aria-hidden className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
              {profile.name?.[0]?.toUpperCase()}
            </span>
            <strong className="truncate text-[0.8125rem] font-semibold text-foreground">{profile.name}</strong>
          </div>
        </div>
      </aside>

      <main
        ref={main}
        id="main-content"
        tabIndex={-1}
        className={cn("px-5 min-[700px]:px-7 min-[1151px]:px-9 pb-[calc(7rem+env(safe-area-inset-bottom))] min-[700px]:pb-[calc(4rem+env(safe-area-inset-bottom))]", SIDEBAR_W)}
        style={{ paddingTop: "calc(1.75rem + env(safe-area-inset-top))" }}
      >
        {/* ponytail: pages not yet ported to the new design stay in a 3xl column */}
        <div key={pageKey} className={cn("mx-auto w-full animate-page-in motion-reduce:animate-none", WIDE_PAGES.includes(pageKey) ? "max-w-[1200px]" : "max-w-3xl")}>
          <ErrorBoundary inline resetKey={location.pathname}><Outlet context={{ profile, navHidden }} /></ErrorBoundary>
        </div>
      </main>

      <nav
        aria-label={t("nav.main")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-2 transition-transform duration-300 ease-out motion-reduce:transition-none min-[700px]:hidden",
          navHidden ? "translate-y-[calc(100%+2rem)]" : "translate-y-0"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        // inert (React 18 lacks the prop) also drops the hidden links from the tab order, which aria-hidden did not.
        {...(navHidden ? { inert: "" } : {})}
      >
        <div className="flex h-[72px] items-stretch justify-around">
          {mobileItems.map(({ to, label, short, icon: Icon, also, badge }) => {
            const active = isActive(to, also);
            return (
              <Link key={to} to={to} aria-current={active ? "page" : undefined} className={cn(mobileLink(active), "group")}>
                {to === "/" ? (
                  <span className="absolute bottom-7 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-raised ring-[5px] ring-card transition-colors group-hover:bg-primary/90 group-active:bg-primary/90">
                    <Icon className="h-6 w-6" strokeWidth={active ? 2.3 : 1.75} />
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.3 : 1.75} />
                    {!!badge && <span aria-hidden className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />}
                  </span>
                )}
                <span>{short ?? label}</span>
                {!!badge && <span className="sr-only">{t("diary.homework", { count: badge })}</span>}
              </Link>
            );
          })}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={mobileLink(moreActive)}>
                <MoreHorizontal className="h-[21px] w-[21px]" strokeWidth={moreActive ? 2.3 : 1.75} />
                <span>{t("nav.more")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-52 p-1">
              {moreItems.map(({ to, label, icon: Icon, also }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive(to, also) ? "page" : undefined}
                  className={
                    cn(
                      "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors",
                      isActive(to, also) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/40"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </nav>
    </div>
  );
}
