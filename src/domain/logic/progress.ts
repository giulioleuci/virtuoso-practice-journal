import { RATING_KEYS, type SegmentEntry } from "../entities/common";
import type { Session } from "../entities/session";
import { entryFor } from "./plan";
import { meanRating } from "./sessionMetrics";

export interface ProgressWeek {
  weekKey: string;
  /** Best BPM reached during the week (null if none logged). */
  bpm: number | null;
  /** Average confidence 1..5 (null if none rated). */
  confidence: number | null;
  /** Average mood 1..5, session means first (null if none rated). */
  mood: number | null;
  /** Average focus 1..5, session means first (null if none rated). */
  focus: number | null;
  /** Distinct days with at least one session (0..7). */
  activeDays: number;
  /** Percentage of BPM-tracked sessions reaching their target (null if none). */
  goalRate: number | null;
}

export interface ProgressTask { id?: number; subjectId: number; itemId?: number; plan?: SegmentEntry[] }

export interface ProgressFilter { subjectId?: number; itemId?: number; segmentId?: number; from?: string; to?: string }

function mondayKey(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

/** Weekly progress series for one subject (or all if subjectId undefined), oldest first, last `weeks` weeks ending at `today`. */
export function weeklyProgress(
  sessions: Pick<Session, "taskId" | "subjectId" | "itemId" | "date" | "marks">[],
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
  const acc = new Map(keys.map((k) => [k, { bpm: null as number | null, confidence: [] as number[], mood: [] as number[], focus: [] as number[], days: new Set<string>(), hit: 0, tracked: 0 }]));
  for (const s of sessions) {
    const task = s.taskId === undefined ? undefined : taskById.get(s.taskId);
    if (f.subjectId != null && s.subjectId !== f.subjectId) continue;
    if (f.itemId != null && s.itemId !== f.itemId) continue;
    if (f.from && s.date < f.from) continue;
    if (f.to && s.date > f.to) continue;
    const marks = f.segmentId != null ? s.marks.filter((m) => m.segmentId === f.segmentId) : s.marks;
    if (f.segmentId != null && !marks.length) continue;
    const a = acc.get(mondayKey(s.date));
    if (!a) continue;
    a.days.add(s.date);
    // Session first, then week: a task with many sections weighs as one observation.
    for (const key of RATING_KEYS) { const value = meanRating(marks, key); if (value) a[key].push(value); }
    for (const m of marks) {
      if (!m.bpm) continue;
      a.bpm = Math.max(a.bpm ?? 0, m.bpm);
      const target = m.targetBpm ?? entryFor(task?.plan ?? [], m.segmentId)?.bpm;
      if (target) {
        a.tracked++;
        if (m.bpm >= target) a.hit++;
      }
    }
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((x, y) => x + y, 0) / xs.length) * 100) / 100 : null);
  return keys.map((k) => {
    const a = acc.get(k)!;
    return {
      weekKey: k,
      bpm: a.bpm,
      confidence: avg(a.confidence),
      mood: avg(a.mood),
      focus: avg(a.focus),
      activeDays: a.days.size,
      goalRate: a.tracked ? Math.round((a.hit / a.tracked) * 100) : null,
    };
  });
}
