import { useState } from "react";
import { useSessionsInRange } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { StatsDashboard } from "@/components/diary/StatsDashboard";
import { ProgressDashboard } from "@/components/diary/ProgressDashboard";

/** Practice analytics: charts and trends, separate from the chronological session log. */
export default function Analytics() {
  const { t } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const sessions = useSessionsInRange(from || undefined, to || undefined);

  return (
    <div className="space-y-5 pb-24">
      <div className="space-y-1">
        <h2 className="font-serif text-3xl">{t("analytics.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("common.from")} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("common.to")} />
      </div>
      {(from || to) && (
        <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs text-primary hover:underline">
          {t("history.clearFilter", { from: from || "…", to: to || "…" })}
        </button>
      )}

      <StatsDashboard from={from || undefined} to={to || undefined} sessions={sessions ?? []} />

      <ProgressDashboard />
    </div>
  );
}
