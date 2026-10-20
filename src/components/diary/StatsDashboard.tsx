import { useMemo } from "react";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Session } from "@/domain/entities/session";
import { useI18n } from "@/lib/i18n";
import { addDays, dayKey, formatDate, parseDayKey } from "@/lib/date";
import { ChartData } from "@/components/shared/ChartData";

interface Props {
  from?: string;
  to?: string;
  sessions?: Session[];
}

export function StatsDashboard({ from, to, sessions: sessionsProp }: Props = {}) {
  const { t, lang } = useI18n();
  const liveSessions = usePresentationRead<Session[]>("sessions.all");
  const sessions = sessionsProp ?? liveSessions;
  const hasRange = !!(from || to);
  const { daily, spark, heatmap, totalWeek, rangeCount } = useMemo(() => {
    const selected = (sessions ?? []).filter(session => (!from || session.date >= from) && (!to || session.date <= to));
    const counts = new Map<string, number>();
    for (const session of selected) counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
    const today = dayKey(new Date());
    const end = parseDayKey(to || today);
    const start = hasRange
      ? parseDayKey(from && from > dayKey(addDays(end, -89)) ? from : dayKey(addDays(end, -89)))
      : addDays(end, -83);
    const daily: { key: string; count: number }[] = [];
    for (let day = start; day <= end; day = addDays(day, 1)) {
      const key = dayKey(day);
      daily.push({ key, count: key > today ? -1 : counts.get(key) ?? 0 });
    }
    const offset = (start.getDay() + 6) % 7;
    const padded = [...Array.from({ length: offset }, () => null), ...daily];
    const heatmap = Array.from({ length: Math.ceil(padded.length / 7) }, (_, index) => padded.slice(index * 7, index * 7 + 7));
    const monday = addDays(parseDayKey(today), -((parseDayKey(today).getDay() + 6) % 7));
    let totalWeek = 0;
    for (let day = monday; dayKey(day) <= today; day = addDays(day, 1)) totalWeek += counts.get(dayKey(day)) ?? 0;
    return { daily, spark: hasRange ? daily : daily.slice(-14), heatmap, totalWeek, rangeCount: selected.length };
  }, [sessions, from, to, hasRange]);

  if (sessions === undefined) return <div className="paper-skeleton h-40" />;
  const max = Math.max(1, ...spark.map(day => day.count));
  const width = 220, height = 36, step = width / Math.max(1, spark.length - 1);
  const path = spark.map((day, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(height - (Math.max(0, day.count) / max) * height).toFixed(1)}`).join(" ");
  const heatColor = (count: number) => count < 0 ? "transparent" : count === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${0.25 + Math.min(1, count / 4) * 0.65})`;
  const sparkLabel = hasRange ? t("stats.daysWindow", { count: spark.length }) : t("stats.last14Days");
  const heatLabel = hasRange ? t("stats.daysWindow", { count: daily.length }) : t("stats.last12Weeks");

  return (
    <section className="space-y-4 border-y border-border py-5">
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Stat label={t("stats.thisWeek")} value={totalWeek} sub={t("stats.sessions")} />
        <Stat label={t(hasRange ? "stats.inRange" : "stats.allTime")} value={rangeCount} />
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{sparkLabel}</p>
        <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {spark.map((day, index) => <circle key={day.key} cx={index * step} cy={height - (Math.max(0, day.count) / max) * height} r={day.count > 0 ? 1.6 : 0} fill="hsl(var(--primary))" />)}
        </svg>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{heatLabel}</p>
        <div className="flex gap-[3px]" aria-hidden="true">
          {heatmap.map((column, index) => <div key={index} className="flex flex-col gap-[3px]">
            {column.map((cell, row) => <div key={cell?.key ?? row} title={cell ? `${formatDate(cell.key, lang, "medium")} · ${Math.max(0, cell.count)} ${t("stats.sessions")}` : undefined} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: heatColor(cell?.count ?? -1) }} />)}
          </div>)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("stats.heatmapHint")}</p>
        <ChartData label={heatLabel} valueLabel={t("stats.sessions")} points={daily.filter(day => day.count >= 0).map(day => ({ label: formatDate(day.key, lang, "medium"), y: day.count, href: `/history?from=${day.key}&to=${day.key}` }))} />
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return <div className="text-center">
    <div className="font-serif text-2xl tabular-nums leading-none">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    {sub && <div className="text-xs italic text-muted-foreground">{sub}</div>}
  </div>;
}
