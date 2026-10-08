import type { Session } from "../entities/session";
import type { SessionQuality } from "../entities/common";

export const QUALITY_SCORE: Record<SessionQuality, number> = { hard: 1, improve: 2, well: 3, great: 4 };

export interface ProgressWeek {
  weekKey: string;
  /** Best BPM reached during the week (null if none logged). */
  bpm: number | null;
  /** Average quality 1..4 (null if none rated). */
  quality: number | null;
  /** Distinct days with at least one session (0..7). */
  activeDays: number;
  /** Percentage of BPM-tracked sessions reaching their target (null if none). */
  goalRate: number | null;
}

export interface ProgressTask { id?: number; subjectId: number; itemId?: number; targetBpm?: number }

export interface ProgressFilter { subjectId?: number; itemId?: number; segmentId?: number; from?: string; to?: string }

function mondayKey(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

/** Weekly progress series for one subject (or all if subjectId undefined), oldest first, last `weeks` weeks ending at `today`. */
export function weeklyProgress(
  sessions: Pick<Session, "taskId" | "date" | "bpmReached" | "quality" | "snapshot" | "segmentMetrics">[],
  tasks: ProgressTask[],
  filter: number | undefined | ProgressFilter,
  weeks: number,
  today: string,
): ProgressWeek[] {
  const f: ProgressFilter = typeof filter === "object" ? filter : { subjectId: filter };
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const end = mondayKey(today);
  const keys: string[] = [];
  const base = new Date(`${end}T00:00:00Z`);
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const acc = new Map(keys.map((k) => [k, { bpm: null as number | null, q: [] as number[], days: new Set<string>(), hit: 0, tracked: 0 }]));
  for (const s of sessions) {
    const task = taskById.get(s.taskId);
    if (f.subjectId != null && task?.subjectId !== f.subjectId) continue;
    if (f.itemId != null && task?.itemId !== f.itemId) continue;
    if (f.from && s.date < f.from) continue;
    if (f.to && s.date > f.to) continue;
    let bpmReached = s.bpmReached;
    let quality = s.quality;
    if (f.segmentId != null) {
      const m = s.segmentMetrics?.[String(f.segmentId)];
      if (!m) continue;
      bpmReached = m.bpmReached;
      quality = m.quality ?? s.quality;
    }
    const a = acc.get(mondayKey(s.date));
    if (!a) continue;
    a.days.add(s.date);
    if (bpmReached) a.bpm = Math.max(a.bpm ?? 0, bpmReached);
    if (quality) a.q.push(QUALITY_SCORE[quality]);
    const target = s.snapshot?.targetBpm ?? task?.targetBpm;
    if (target && bpmReached) {
      a.tracked++;
      if (bpmReached >= target) a.hit++;
    }
  }
  return keys.map((k) => {
    const a = acc.get(k)!;
    return {
      weekKey: k,
      bpm: a.bpm,
      quality: a.q.length ? Math.round((a.q.reduce((x, y) => x + y, 0) / a.q.length) * 100) / 100 : null,
      activeDays: a.days.size,
      goalRate: a.tracked ? Math.round((a.hit / a.tracked) * 100) : null,
    };
  });
}
