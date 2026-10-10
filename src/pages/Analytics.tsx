import { useCallback, useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/pdfExport";
import { formatDate, dayKey } from "@/lib/date";
import type { ProgressFilterLabels } from "@/components/diary/ProgressDashboard";
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

  const ref = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<ProgressFilterLabels>({ weeks: 12 });
  const [busy, setBusy] = useState(false);
  const onFilters = useCallback((f: ProgressFilterLabels) => setLabels(f), []);
  const exportPdf = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const all = t("common.all");
      await exportElementToPdf(ref.current, {
        fileName: `analytics-${dayKey(new Date())}.pdf`,
        title: t("analytics.title"),
        lines: [
          `${t("analytics.pdfPeriod")}: ${from ? formatDate(from) : "…"} – ${to ? formatDate(to) : "…"}`,
          `${t("analytics.pdfSubject")}: ${labels.subject ?? all}`,
          `${t("progress.item")}: ${labels.item ?? t("progress.allItems")}`,
          `${t("progress.segment")}: ${labels.segment ?? t("progress.allSegments")}`,
          `${t("analytics.pdfWeeks")}: ${labels.weeks}`,
        ],
      });
      toast.success(t("analytics.pdfDone"));
    } catch {
      toast.error(t("analytics.pdfError"));
    } finally {
      setBusy(false);
    }
  };

  const sessions = useSessionsInRange(from || undefined, to || undefined);

  return (
    <div ref={ref} className="space-y-5 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-serif text-3xl">{t("analytics.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
        </div>
        <Button data-pdf-ignore="true" variant="outline" size="sm" className="min-h-11 shrink-0" onClick={exportPdf} disabled={busy} aria-label={t("analytics.exportPdf")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          <span>{t("analytics.exportPdfShort")}</span>
        </Button>
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

      <ProgressDashboard from={from || undefined} to={to || undefined} onFiltersChange={onFilters} />
    </div>
  );
}
