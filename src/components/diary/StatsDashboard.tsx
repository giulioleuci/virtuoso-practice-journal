import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
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

export function StatsDashboard() {
  const sessions = useLiveQuery(() => db.sessions.toArray());

  const { streak, last14, heatmap, totalWeek, totalMinutesEstimate } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions ?? []) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    const daySet = new Set(counts.keys());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last14: { key: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      last14.push({ key: k, count: counts.get(k) ?? 0 });
    }

    // 12 weeks heatmap, columns are weeks (Mon start)
    const weeks: { key: string; count: number }[][] = [];
    const start = new Date(today);
    const dow = (start.getDay() + 6) % 7; // make Monday=0
    start.setDate(start.getDate() - dow - 7 * 11);
    for (let w = 0; w < 12; w++) {
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

    return {
      streak: computeStreak(daySet),
      last14,
      heatmap: weeks,
      totalWeek,
      totalMinutesEstimate: (sessions ?? []).length * 10,
    };
  }, [sessions]);

  const max = Math.max(1, ...last14.map((d) => d.count));
  const w = 220, h = 36, step = w / (last14.length - 1);
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
        <Stat label="Streak" value={`${streak}d`} icon={<Flame className="h-4 w-4 text-primary mx-auto" />} />
        <Stat label="This week" value={`${totalWeek}`} sub="sessions" />
        <Stat label="All time" value={`${(sessions ?? []).length}`} sub={`~${totalMinutesEstimate}m`} />
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Last 14 days</div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {last14.map((d, i) => (
            <circle key={d.key} cx={i * step} cy={h - (d.count / max) * h} r={d.count > 0 ? 1.6 : 0} fill="hsl(var(--primary))" />
          ))}
        </svg>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Last 12 weeks</div>
        <div className="flex gap-[3px]">
          {heatmap.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => (
                <div
                  key={cell.key}
                  title={`${cell.key} · ${cell.count >= 0 ? cell.count : 0} sessions`}
                  className="w-3 h-3 rounded-[2px]"
                  style={{ backgroundColor: heatColor(cell.count) }}
                />
              ))}
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
