import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Route-backed tabs for the subpages of one area. */
export function SectionTabs({ label, tabs }: { label: string; tabs: [to: string, label: string][] }) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-x-6 border-b border-border">
      {tabs.map(([to, text]) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) => cn("-mb-px inline-flex min-h-11 items-center border-b-2 pb-2 text-sm font-medium", isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {text}
        </NavLink>
      ))}
    </nav>
  );
}

/** Section tabs of the Progress area: analysis and the session log. */
export function ProgressTabs() {
  const { t } = useI18n();
  return <SectionTabs label={t("nav.progress")} tabs={[["/analytics", t("nav.analytics")], ["/history", t("nav.history")]]} />;
}
