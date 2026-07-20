import { useTasksByItem } from "@/hooks/useEntities";
import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { Session } from "@/domain/entities/session";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";

interface Props {
  itemId: number;
  weeks?: number;
}

/**
 * Compact sparkline showing best BPM reached per week for sessions linked to
 * tasks belonging to a given library item.
 */
export function BpmSparkline({ itemId, weeks = 8 }: Props) {
  const { t } = useI18n();
  const tasks = useTasksByItem(itemId);
  const sessions = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);

  const { points, max, min } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets: (number | null)[] = Array(weeks).fill(null);

    for (const s of sessions ?? []) {
      if (!s.bpmReached) continue;
      const sd = new Date(s.date);
      const diffDays = Math.floor((today.getTime() - sd.getTime()) / 86400000);
      const wkIdx = weeks - 1 - Math.floor(diffDays / 7);
      if (wkIdx < 0 || wkIdx >= weeks) continue;
      const cur = buckets[wkIdx];
      buckets[wkIdx] = cur == null ? s.bpmReached : Math.max(cur, s.bpmReached);
    }

    const filled: number[] = [];
    let last = 0;
    for (const v of buckets) {
      if (v != null) last = v;
      filled.push(last);
    }
    const nonZero = filled.filter((v) => v > 0);
    return {
      points: filled,
      max: nonZero.length ? Math.max(...nonZero) : 0,
      min: nonZero.length ? Math.min(...nonZero) : 0,
    };
  }, [sessions, weeks]);

  if (!tasks?.length || max === 0) return null;

  const w = 80, h = 22;
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points
    .map((v, i) => {
      const y = v === 0 ? h : h - ((v - min) / range) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex items-center gap-1.5" title={t("library.bpmSparklineTitle", { min, max, count: weeks })}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-20" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[10px] text-muted-foreground tabular-nums">{max}</span>
    </div>
  );
}
