import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Session } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { Flame } from "lucide-react";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(daysWithSessions: Set<string>): number {
  let streak = 0;
  const d = new Date();
  // If no session today, allow streak to start from yesterday
  if (!daysWithSessions.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (daysWithSessions.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

interface Props {
  /** YYYY-MM-DD inclusive lower bound */
  from?: string;
  /** YYYY-MM-DD inclusive upper bound */
  to?: string;
  /** Optional pre-filtered sessions; when provided, stats reflect these instead of the full DB. */
  sessions?: Session[];
}

export function StatsDashboard({ from, to, sessions: sessionsProp }: Props = {}) {
  const { t } = useI18n();
  // Only hit the DB when no pre-filtered sessions are provided.
  const liveSessions = useLiveQuery(
    () => (sessionsProp ? Promise.resolve(undefined) : db.sessions.toArray()),
    [sessionsProp],
  );
  const sessions = sessionsProp ?? liveSessions;

  const hasRange = !!(from || to);

  const { streak, last14, heatmap, totalWeek, rangeCount, rangeMinutes, rangeDays, rangeLabel, last14Label, heatmapLabel } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions ?? []) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    const daySet = new Set(counts.keys());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine sparkline window: range if provided (capped to ~60 days), else last 14
    const parse = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      dt.setHours(0, 0, 0, 0);
      return dt;
    };
    const sparkEnd = to ? parse(to) : new Date(today);
    const sparkStart = from
      ? parse(from)
      : (() => { const d = new Date(sparkEnd); d.setDate(d.getDate() - 13); return d; })();
    const dayCount = Math.max(1, Math.min(90, Math.round((sparkEnd.getTime() - sparkStart.getTime()) / 86400000) + 1));
    const last14: { key: string; count: number }[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(sparkStart);
      d.setDate(sparkStart.getDate() + i);
      const k = dayKey(d);
      last14.push({ key: k, count: counts.get(k) ?? 0 });
    }

    // Heatmap: weeks ending at sparkEnd, count weeks to cover the span (1..16)
    const heatEnd = new Date(sparkEnd);
    const dow = (heatEnd.getDay() + 6) % 7;
    const heatLastMon = new Date(heatEnd);
    heatLastMon.setDate(heatEnd.getDate() - dow);
    const weeksNeeded = Math.max(1, Math.min(16, Math.ceil(dayCount / 7)));
    const start = new Date(heatLastMon);
    start.setDate(heatLastMon.getDate() - 7 * (weeksNeeded - 1));
    const weeks: { key: string; count: number }[][] = [];
    for (let w = 0; w < weeksNeeded; w++) {
      const col: { key: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        const k = dayKey(day);
        col.push({ key: k, count: day > today ? -1 : counts.get(k) ?? 0 });
      }
      weeks.push(col);
    }

    let totalWeek = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      totalWeek += counts.get(dayKey(d)) ?? 0;
    }

    const rangeCount = (sessions ?? []).filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    }).length;

    return {
      streak: computeStreak(daySet),
      last14,
      heatmap: weeks,
      totalWeek,
      rangeCount,
      rangeMinutes: rangeCount * 10,
      rangeDays: dayCount,
      rangeLabel: hasRange ? t("stats.inRange") : t("stats.allTime"),
      last14Label: hasRange
        ? t("stats.daysWindow", { count: dayCount })
        : t("stats.last14Days"),
      heatmapLabel: hasRange
        ? t("stats.weeksWindow", { count: weeksNeeded })
        : t("stats.last12Weeks"),
    };
  }, [sessions, from, to, hasRange, t]);

  const max = Math.max(1, ...last14.map((d) => d.count));
  const w = 220, h = 36, step = w / Math.max(1, last14.length - 1);
  const path = last14
    .map((d, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (d.count / max) * h).toFixed(1)}`)
    .join(" ");

  const heatColor = (c: number) => {
    if (c < 0) return "transparent";
    if (c === 0) return "hsl(var(--muted))";
    const intensity = Math.min(1, c / 4);
    return `hsl(var(--primary) / ${0.25 + intensity * 0.65})`;
  };

  return (
    <section className="paper-card p-5 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("stats.streak")} value={`${streak}d`} icon={<Flame className="h-4 w-4 text-primary mx-auto" />} />
        <Stat label={t("stats.thisWeek")} value={`${totalWeek}`} sub={t("stats.sessions")} />
        <Stat label={rangeLabel} value={`${hasRange ? rangeCount : (sessions ?? []).length}`} sub={`~${hasRange ? rangeMinutes : (sessions ?? []).length * 10}m`} />
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{last14Label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {last14.map((d, i) => (
            <circle key={d.key} cx={i * step} cy={h - (d.count / max) * h} r={d.count > 0 ? 1.6 : 0} fill="hsl(var(--primary))" />
          ))}
        </svg>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{heatmapLabel}</div>
        <div className="flex gap-[3px]">
          {heatmap.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => {
                const isFuture = cell.count < 0;
                const cellEl = (
                  <div
                    title={`${cell.key} · ${cell.count >= 0 ? cell.count : 0} ${t("stats.sessions")}`}
                    className="w-3 h-3 rounded-[2px] transition-transform hover:scale-125"
                    style={{ backgroundColor: heatColor(cell.count) }}
                  />
                );
                return isFuture ? (
                  <div key={cell.key}>{cellEl}</div>
                ) : (
                  <Link key={cell.key} to={`/history?from=${cell.key}&to=${cell.key}`}>
                    {cellEl}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      {icon && <div className="mb-1">{icon}</div>}
      <div className="font-serif text-2xl tabular-nums leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground italic">{sub}</div>}
    </div>
  );
}
