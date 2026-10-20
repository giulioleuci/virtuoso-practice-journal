import { useMemo, useState } from "react";
import { useItem, useProfile } from "@/presentation/hooks/useEntities";
import type { Lang } from "@/domain/entities/common";
import type { Session } from "@/domain/entities/session";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import { useI18n } from "@/lib/i18n";
import { BpmTimelineChart } from "./BpmTimelineChart";
import { meanConfidence } from "@/domain/logic/sessionMetrics";
import { TrendIcon } from "@/lib/icons";
import { EmptyState } from "@/components/shared/EmptyState";
import { weeklySessionCounts } from "@/lib/domain/analytics";
import { formatDate, getDefaultWeekStartsOn } from "@/lib/date";


interface ChartPoint { x: number; y: number; label: string }

function formatDay(date: string, lang: Lang): string {
  return formatDate(date, lang, "medium");
}

function ChartData({ points, label }: { points: ChartPoint[]; label: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer py-3 text-xs text-primary">{t("analysis.dataTable")}: {label}</summary>
    {open && <table aria-label={label} className="w-full text-left text-xs tabular-nums">
      <thead><tr><th scope="col" className="py-2">{t("common.date")}</th><th scope="col" className="py-2">{label}</th></tr></thead>
      <tbody>{points.map((point, index) => <tr key={index} className="border-t border-border"><td className="py-2">{point.label}</td><td className="py-2">{point.y}</td></tr>)}</tbody>
    </table>}
  </details>;
}

function LineChart({ points, target, color = "hsl(var(--primary))", targetColor = "hsl(var(--muted-foreground))" }: {
  points: ChartPoint[];
  target?: number;
  color?: string;
  targetColor?: string;
}) {
  const w = 320, h = 80;
  if (points.length === 0) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground italic">No data</div>;

  const values = points.map((p) => p.y);
  const allValues = target != null ? [...values, target] : values;
  const lo = Math.min(...allValues) * 0.95;
  const hi = Math.max(...allValues) * 1.05;
  const range = Math.max(1, hi - lo);
  const xStep = points.length > 1 ? w / (points.length - 1) : w / 2;

  const toX = (i: number) => i * xStep;
  const toY = (v: number) => h - ((v - lo) / range) * (h - 4) - 2;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.y).toFixed(1)}`).join(" ");
  const targetY = target != null ? toY(target) : null;
  const plotted = points.map((point, index) => ({ point, index })).filter(({ index }) => index % Math.ceil(points.length / 200) === 0 || index === points.length - 1);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      {targetY != null && (
        <line x1={0} y1={targetY} x2={w} y2={targetY} stroke={targetColor} strokeWidth={1} strokeDasharray="4 3" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {plotted.map(({ point, index }) => (
        <circle key={index} cx={toX(index)} cy={toY(point.y)} r={3} fill={color} />
      ))}
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-2 h-14" aria-hidden="true">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${Math.max(2, (d.count / max) * 48)}px`,
              backgroundColor: d.color,
              opacity: d.count === 0 ? 0.2 : 1,
            }}
          />
          <span className="text-xs text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Charts for one library item (BPM, confidence, quality, weekly volume or theory layers). */
export function ItemAnalysis({ itemId }: { itemId: number }) {
  const { t, lang } = useI18n();
  const item = useItem(itemId);
  const profile = useProfile();
  const sessions = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);

  const isTheory = item?.kind === "theory";

  const confidencePoints = useMemo((): ChartPoint[] => {
    const points: ChartPoint[] = [];
    for (const s of [...(sessions ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
      const confidence = meanConfidence(s.marks);
      if (confidence == null) continue;
      points.push({ x: points.length, y: confidence, label: formatDay(s.date, lang) });
    }
    return points;
  }, [sessions, lang]);

  const sessionsPerWeek = useMemo((): ChartPoint[] => {
    if (!sessions?.length) return [];
    const weekStartsOn = profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);
    return weeklySessionCounts(sessions, 12, weekStartsOn).map(({ weekKey, count }, i) => ({
      x: i,
      y: count,
      label: formatDay(weekKey, lang),
    }));
  }, [sessions, lang, profile]);

  if (!item) return <p className="text-muted-foreground">{t("common.loading")}</p>;

  const panel = "space-y-3 border-t border-border pt-4";

  if ((sessions?.length ?? 0) === 0) {
    return <EmptyState title={t("analysis.noData")} />;
  }

  return (
    <div className="grid gap-x-8 gap-y-6 min-[900px]:grid-cols-2">
      {!isTheory && sessions?.some(s => s.marks.some(m => m.bpm !== undefined)) && (
        <section className={panel}>
          <div className="flex items-center gap-2">
            <TrendIcon className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-xl font-semibold">{t("analysis.bpmTrend")}</h3>
          </div>
          <BpmTimelineChart sessions={sessions ?? []} targetBpm={item.targetBpm} targetNoteVal={item.noteVal} />
        </section>
      )}

      {confidencePoints.length > 0 && (
        <section className={panel}>
          <h3 className="font-serif text-xl font-semibold">{t("analysis.confidenceTrend")}</h3>
          <LineChart points={confidencePoints} target={5} color="hsl(var(--key-plum))" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{confidencePoints[0]?.label}</span>
            <span>{confidencePoints[confidencePoints.length - 1]?.label}</span>
          </div>
          <ChartData points={confidencePoints} label={t("analysis.confidenceTrend")} />
        </section>
      )}

      {sessionsPerWeek.length > 1 && (
        <section className={panel}>
          <h3 className="font-serif text-xl font-semibold">{t("analysis.sessionsPerWeek")}</h3>
          <BarChart data={sessionsPerWeek.map((p) => ({ label: p.label.split(" ")[0] ?? "", count: p.y, color: "hsl(var(--key-sage))" }))} />
          <ChartData points={sessionsPerWeek} label={t("analysis.sessionsPerWeek")} />
        </section>
      )}
    </div>
  );
}
