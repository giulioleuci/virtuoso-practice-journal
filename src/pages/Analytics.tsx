import { useCallback, useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/pdfExport";
import { formatDate, dayKey } from "@/lib/date";
import type { ProgressFilterLabels } from "@/components/diary/ProgressDashboard";
import { useSessionsInRange } from "@/presentation/hooks/useEntities";
import { useI18n } from "@/lib/i18n";

import { PageHeader } from "@/components/shared/PageHeader";
import { FilterPanel, FilterDateRange } from "@/components/shared/FilterPanel";
import { ProgressTabs } from "@/components/shared/ProgressTabs";
import { StatsDashboard } from "@/components/diary/StatsDashboard";
import { ProgressDashboard } from "@/components/diary/ProgressDashboard";

/** Practice analytics: charts and trends, separate from the chronological session log. */
export default function Analytics() {
  const { t, lang } = useI18n();
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
          `${t("analytics.pdfPeriod")}: ${from ? formatDate(from, lang) : "…"} – ${to ? formatDate(to, lang) : "…"}`,
          `${t("common.subject")}: ${labels.subject ?? all}`,
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
    <div ref={ref} className="pb-24">
      <PageHeader
        title={t("nav.progress")}

        actions={
          <Button data-pdf-ignore="true" variant="outline" onClick={exportPdf} disabled={busy} aria-label={t("analytics.exportPdf")}>
            {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
            <span>{t("analytics.exportPdfShort")}</span>
          </Button>
        }
      />
      <ProgressTabs />

      <FilterPanel filters={[
        ...(from ? [{ key: "from", label: `${t("common.from")}: ${formatDate(from, lang)}`, onRemove: () => setFrom("") }] : []),
        ...(to ? [{ key: "to", label: `${t("common.to")}: ${formatDate(to, lang)}`, onRemove: () => setTo("") }] : []),
      ]} onReset={() => { setFrom(""); setTo(""); }}>
        <FilterDateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </FilterPanel>
      <StatsDashboard from={from || undefined} to={to || undefined} sessions={sessions ?? []} />

      <ProgressDashboard from={from || undefined} to={to || undefined} onFiltersChange={onFilters} />
    </div>
  );
}
