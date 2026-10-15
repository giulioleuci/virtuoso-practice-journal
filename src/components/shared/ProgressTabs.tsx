import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Section tabs of the Progress area: analysis and the session log. */
export function ProgressTabs() {
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.progress")} className="mb-5 flex gap-6 border-b border-border">
      {[["/analytics", t("nav.analytics")], ["/history", t("nav.history")]].map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => cn("-mb-px border-b-2 pb-2 text-sm font-medium", isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
