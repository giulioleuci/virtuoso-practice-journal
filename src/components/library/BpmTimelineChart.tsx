import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { NoteVal } from "@/domain/entities/common";
import type { Session } from "@/domain/entities/session";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { confidenceLabel, tempoLabel } from "@/lib/format";
import { meanConfidence, topMark } from "@/domain/logic/sessionMetrics";
import { Slider } from "@/components/ui/slider";

interface Props {
  sessions: Session[];
  targetBpm?: number;
  targetNoteVal?: NoteVal;
  /** Chart only the marks of this section. */
  segmentId?: number;
}

/**
 * Interactive tempo timeline for a single piece: a BPM line over time with a
 * scrubber that reveals the confidence and notes logged on that date.
 */
export function BpmTimelineChart({ sessions, targetBpm, targetNoteVal, segmentId }: Props) {
  const { t, lang } = useI18n();

  const points = useMemo(
    () =>
      sessions
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .flatMap((session) => {
          const marks = segmentId === undefined ? session.marks : session.marks.filter((m) => m.segmentId === segmentId);
          return [...new Set(marks.filter(m => m.bpm !== undefined).map(m => m.noteVal ?? "quarter"))].flatMap(figure => {
            const top = topMark(marks.filter(m => (m.noteVal ?? "quarter") === figure));
            return top?.bpm ? [{ date: session.date, bpm: top.bpm, noteVal: top.noteVal, confidence: meanConfidence(marks), label: formatDate(session.date, lang, "dayMonth"), session }] : [];
          });
        }),
    [sessions, lang, segmentId],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(points.length ? points.length - 1 : 0);
  }, [points.length]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("drilldown.noBpmData")}</p>;
  }

  const active = points[Math.min(index, points.length - 1)];
  const first = points[0];
  const comparable = (active.noteVal ?? "quarter") === (first.noteVal ?? "quarter");
  const sameTargetFigure = (active.noteVal ?? "quarter") === (targetNoteVal ?? "quarter");
  const mixedFigures = new Set(points.map(p => p.noteVal ?? "quarter")).size > 1;
  const delta = active.bpm - first.bpm;
  const maxBpm = Math.max(targetBpm ?? 0, ...points.map((point) => point.bpm));
  const chartPoints = points.map((point, position) => ({ ...point, position }))
    .filter((_, position) => position % Math.ceil(points.length / 200) === 0 || position === points.length - 1 || position === index);

  return (
    <div className="space-y-3">
      {targetBpm !== undefined && <p className="text-xs text-muted-foreground">{t("library.targetTempo")}: {tempoLabel(targetNoteVal, targetBpm)}</p>}
      {mixedFigures ? <ul className="max-h-64 overflow-y-auto divide-y divide-border">{points.map(point => <li key={`${point.session.id}:${point.noteVal ?? "quarter"}`} className="flex justify-between gap-3 py-2 text-sm tabular-nums"><span>{formatDate(point.date, lang, "medium")}</span><span>{tempoLabel(point.noteVal, point.bpm)}</span></li>)}</ul> : <div className="h-40" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartPoints} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="position" type="number" domain={[0, Math.max(1, points.length - 1)]} tickFormatter={position => points[Math.round(position)]?.label ?? ""} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
            <YAxis domain={[0, Math.ceil((maxBpm + 10) / 10) * 10]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={38} />
            {targetBpm && sameTargetFigure ? (
              <ReferenceLine y={targetBpm} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
            ) : null}
            <ReferenceLine x={Math.min(index, points.length - 1)} stroke="hsl(var(--primary))" strokeWidth={1.5} />
            <Line
              type="monotone"
              dataKey="bpm"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>}

      {points.length > 1 && (
        <Slider
          value={[Math.min(index, points.length - 1)]}
          min={0}
          max={points.length - 1}
          step={1}
          onValueChange={([value]) => setIndex(value)}
          aria-label={t("drilldown.scrub")}
          aria-valuetext={`${formatDate(active.date, lang, "medium")}: ${tempoLabel(active.noteVal, active.bpm)}${active.confidence === undefined ? "" : ` · ${confidenceLabel(active.confidence)}`}`}
        />
      )}

      <div className="rounded-lg border border-border p-3 space-y-1.5" aria-live="polite">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{formatDate(active.date, lang, "medium")}</span>
          <span className="text-sm tabular-nums font-medium">
            {tempoLabel(active.noteVal, active.bpm)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {comparable ? t("drilldown.sinceStart").replace("{delta}", `${delta >= 0 ? "+" : ""}${delta}`) : ""}
          {targetBpm && sameTargetFigure ? ` · ${t("drilldown.ofTarget").replace("{pct}", String(Math.round((active.bpm / targetBpm) * 100)))}` : ""}
        </p>
        {active.confidence !== undefined && <p className="text-xs tabular-nums">{confidenceLabel(active.confidence)}</p>}
        {active.session.notes ? (
          <p className="text-xs text-muted-foreground break-words whitespace-pre-line">{active.session.notes}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t("drilldown.noNotes")}</p>
        )}
      </div>
    </div>
  );
}
