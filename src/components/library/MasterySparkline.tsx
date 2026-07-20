import { usePresentationRead } from "@/presentation/hooks/usePresentationQuery";
import type { TheoryLayer } from "@/domain/constants/theoryLayers";
import type { Session } from "@/domain/entities/session";
import { useMemo } from "react";

interface Props {
  itemId: number;
  layer: TheoryLayer;
  weeks?: number;
}

/**
 * Compact sparkline showing score for a single theory mastery dimension
 * per week, derived from session layerScores.
 */
export function MasterySparkline({ itemId, layer, weeks = 8 }: Props) {
  const sessions = usePresentationRead<Session[]>("sessions.segmentHistory", [itemId]);

  const { points, max } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets: (number | null)[] = Array(weeks).fill(null);

    for (const s of sessions ?? []) {
      const score = s.layerScores?.[layer];
      if (score == null) continue;
      const sd = new Date(s.date);
      const diffDays = Math.floor((today.getTime() - sd.getTime()) / 86400000);
      const wkIdx = weeks - 1 - Math.floor(diffDays / 7);
      if (wkIdx < 0 || wkIdx >= weeks) continue;
      const cur = buckets[wkIdx];
      buckets[wkIdx] = cur == null ? score : Math.max(cur, score);
    }

    const filled: number[] = [];
    let last = 0;
    for (const v of buckets) {
      if (v != null) last = v;
      filled.push(last);
    }
    return {
      points: filled,
      max: Math.max(...filled.filter((v) => v > 0), 0),
    };
  }, [sessions, layer, weeks]);

  if (max === 0) return null;

  const w = 56, h = 18;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points
    .map((v, i) => {
      const y = v === 0 ? h : h - (v / 100) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-4 w-14" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
