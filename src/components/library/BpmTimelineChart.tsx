import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { Session } from "@/domain/entities/session";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import { NOTE_GLYPH } from "@/lib/constants";
import { Slider } from "@/components/ui/slider";

interface Props {
  sessions: Session[];
  targetBpm?: number;
}

const qualityKey = (q?: string) => (q ? `session.quality${q.charAt(0).toUpperCase()}${q.slice(1)}` : undefined);

/**
 * Interactive tempo timeline for a single piece: a BPM line over time with a
 * scrubber that reveals the quality rating and notes logged on that date.
 */
export function BpmTimelineChart({ sessions, targetBpm }: Props) {
  const { t, lang } = useI18n();

  const points = useMemo(
    () =>
      sessions
        .filter((session) => typeof session.bpmReached === "number" && session.bpmReached > 0)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((session) => ({
          date: session.date,
          bpm: session.bpmReached as number,
          label: formatDate(session.date, lang, "dayMonth"),
          session,
        })),
    [sessions, lang],
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
  const delta = active.bpm - first.bpm;
  const maxBpm = Math.max(targetBpm ?? 0, ...points.map((point) => point.bpm));

  return (
    <div className="space-y-3">
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
            <YAxis domain={[0, Math.ceil((maxBpm + 10) / 10) * 10]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={38} />
            {targetBpm ? (
              <ReferenceLine y={targetBpm} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
            ) : null}
            <ReferenceLine x={active.label} stroke="hsl(var(--primary))" strokeWidth={1.5} />
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
      </div>

      {points.length > 1 && (
        <Slider
          value={[Math.min(index, points.length - 1)]}
          min={0}
          max={points.length - 1}
          step={1}
          onValueChange={([value]) => setIndex(value)}
          aria-label={t("drilldown.scrub")}
        />
      )}

      <div className="rounded-lg border border-border p-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{formatDate(active.date, lang, "medium")}</span>
          <span className="text-sm tabular-nums font-medium">
            {active.session.noteVal ? NOTE_GLYPH[active.session.noteVal] : "♩"}={active.bpm}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {t("drilldown.sinceStart").replace("{delta}", `${delta >= 0 ? "+" : ""}${delta}`)}
          {targetBpm ? ` · ${t("drilldown.ofTarget").replace("{pct}", String(Math.round((active.bpm / targetBpm) * 100)))}` : ""}
        </p>
        {active.session.quality && (
          <p className="text-xs">{t(qualityKey(active.session.quality) as string)}</p>
        )}
        {active.session.notes ? (
          <p className="text-xs text-muted-foreground break-words whitespace-pre-line">{active.session.notes}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t("drilldown.noNotes")}</p>
        )}
      </div>
    </div>
  );
}
