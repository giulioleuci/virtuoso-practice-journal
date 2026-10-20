import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

/** A readable alternative to a chart, mounted only when requested. */
export function ChartData({ points, label, valueLabel = label }: { points: { label: string; y: number | null; href?: string }[]; label: string; valueLabel?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)} data-pdf-ignore="true">
    <summary className="min-h-11 cursor-pointer py-3 text-xs text-primary">{t("analysis.dataTable")}: {label}</summary>
    {open && <table aria-label={label} className="w-full table-fixed text-left text-xs tabular-nums">
      <thead><tr><th scope="col" className="py-2">{t("common.date")}</th><th scope="col" className="py-2">{valueLabel}</th></tr></thead>
      <tbody>{points.map((point, index) => <tr key={index} className="border-t border-border"><td className="py-2 [overflow-wrap:anywhere]">{point.href ? <Link className="inline-flex min-h-11 items-center text-primary hover:underline" to={point.href}>{point.label}</Link> : point.label}</td><td className="py-2">{point.y ?? "—"}</td></tr>)}</tbody>
    </table>}
  </details>;
}
