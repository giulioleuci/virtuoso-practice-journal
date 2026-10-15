/** Pure study-routine task generation: pool keys, adaptive weighting, sampling, day loop.
 *
 * No Dexie access — the repository resolves pool entries and collects practice
 * stats from the DB, then hands the resolved inputs here to produce the tasks.
 */
import type { StudyPoolEntry, StudyRoutine, Task } from "@/lib/db";
import { emptyEntry } from "@/domain/logic/plan";
import { parseDayKey, dayKey, addDays, weekKey } from "@/lib/date";

export interface ResolvedPoolItem {
  key: string;
  type: "item" | "segment" | "collection";
  title: string;
  /** For segment entries: the parent library item's title. */
  parentTitle?: string;
  itemId?: number;
  segmentIds?: number[];
  collectionId?: number;
  linkType: "item" | "collection";
}

/** How strongly the draw is skewed towards the items you feel least sure about. */
export type Adaptivity = "uniform" | "balanced" | "aggressive";

/** Practice history for one pool entry, as collected by the repository. */
export interface PoolStat {
  /** Recency-weighted average confidence 1-5, or null when there is no history. */
  confidence: number | null;
  /** Local `YYYY-MM-DD` key of the last logged session, when known. */
  lastPracticed?: string;
  /** Number of sessions that fed the average. */
  sessions: number;
}

/** Days without practice after which an entry counts as fully "stale". */
export const STALE_DAYS = 14;

/** Stable identity key for a pool entry. */
export function poolEntryKey(entry: StudyPoolEntry): string {
  return `${entry.type}:${entry.id}`;
}

/** Map an average confidence (1-5, or null for no history) to a sampling weight. */
export function confidenceToWeight(avg: number | null): number {
  if (avg === null) return 3;
  if (avg <= 1.5) return 5;
  if (avg <= 2.5) return 4;
  if (avg <= 3.5) return 3;
  if (avg <= 4.5) return 2;
  return 1;
}

/**
 * Average a list of confidence values ordered newest-first, giving recent
 * ratings more say than older ones. Returns null for an empty list.
 */
export function decayedAverage(newestFirst: number[], decay = 0.75): number | null {
  if (!newestFirst.length) return null;
  let weighted = 0;
  let total = 0;
  newestFirst.forEach((value, index) => {
    const factor = decay ** index;
    weighted += value * factor;
    total += factor;
  });
  return weighted / total;
}

function daysBetween(from: string, to: string): number {
  const ms = parseDayKey(to).getTime() - parseDayKey(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Sampling weight for one pool entry: low confidence and long time since the
 * last session both raise it. "uniform" flattens everything to 1.
 */
export function adaptiveWeight(
  stat: PoolStat | undefined,
  adaptivity: Adaptivity,
  todayKey: string,
): number {
  if (adaptivity === "uniform") return 1;
  const confidence = stat?.confidence ?? null;
  // No history yet → treat as a new item that should enter rotation quickly.
  const base = confidence === null ? 5 : Math.max(1, Math.min(5, 6 - confidence));
  const days = stat?.lastPracticed ? daysBetween(stat.lastPracticed, todayKey) : STALE_DAYS;
  const recency = Math.min(days / STALE_DAYS, 1) * 2;
  const raw = base + recency;
  return adaptivity === "aggressive" ? raw * raw : raw;
}

/** Build the weight map a draw uses, from practice stats. */
export function buildWeights(
  keys: string[],
  stats: Map<string, PoolStat> | null | undefined,
  adaptivity: Adaptivity,
  todayKey: string,
): Map<string, number> {
  return new Map(keys.map((key) => [key, adaptiveWeight(stats?.get(key), adaptivity, todayKey)]));
}

/** Share of the draw each entry is expected to take (0-1), for UI preview. */
export function estimateSelectionShare(weights: Map<string, number>): Map<string, number> {
  const total = [...weights.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return new Map([...weights.keys()].map((key) => [key, 0]));
  return new Map([...weights.entries()].map(([key, value]) => [key, value / total]));
}

/** Small deterministic PRNG so a preview can be reproduced from a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedSampleWithoutReplacement(
  items: ResolvedPoolItem[],
  count: number,
  weights: Map<string, number>,
  rng: () => number = Math.random,
): ResolvedPoolItem[] {
  if (count >= items.length) return [...items];
  const remaining = [...items];
  const selected: ResolvedPoolItem[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const total = remaining.reduce((sum, item) => sum + (weights.get(item.key) ?? 3), 0);
    let r = rng() * total;
    let idx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      r -= weights.get(remaining[j].key) ?? 3;
      if (r <= 0) { idx = j; break; }
    }
    selected.push(...remaining.splice(idx, 1));
  }

  return selected;
}

export function uniformSampleWithoutReplacement(
  items: ResolvedPoolItem[],
  count: number,
  rng: () => number = Math.random,
): ResolvedPoolItem[] {
  if (count >= items.length) return [...items];
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function buildTask(
  item: ResolvedPoolItem,
  date: string,
  subjectId: number,
  routineId: number,
  createdAt: number,
): Omit<Task, "id"> {
  return {
    date,
    subjectId,
    linkType: item.linkType,
    itemId: item.itemId,
    collectionId: item.collectionId,
    title: item.title,
    plan: (item.segmentIds ?? []).map((id) => emptyEntry(id)),
    done: false,
    studyRoutineId: routineId,
    createdAt,
  };
}

/** Resolve the adaptivity of a routine, accepting the legacy boolean flag. */
export function routineAdaptivity(routine: Pick<StudyRoutine, "adaptivity" | "useSpacedRepetition">): Adaptivity {
  if (routine.adaptivity) return routine.adaptivity;
  return routine.useSpacedRepetition ? "balanced" : "uniform";
}

export interface GenerateRoutineTasksOptions {
  routine: StudyRoutine;
  groupItems: Map<string, ResolvedPoolItem[]>;
  stats?: Map<string, PoolStat> | null;
  fromDate: string;
  createdAt: number;
  /** Per-key counters already used up in the current week (regeneration). */
  seedCounters?: Map<string, number>;
  weekStartsOn?: number;
  /** Deterministic source of randomness (preview). */
  rng?: () => number;
}

/**
 * Generate the concrete tasks for a routine over its horizon, given resolved
 * pool items per group and (optionally) practice stats. Pure: no DB.
 */
export function generateRoutineTasks({
  routine,
  groupItems,
  stats,
  fromDate,
  createdAt,
  seedCounters,
  weekStartsOn = 1,
  rng = Math.random,
}: GenerateRoutineTasksOptions): Omit<Task, "id">[] {
  const startDate = parseDayKey(fromDate);
  const endDate = addDays(startDate, routine.weeksAhead * 7);
  const adaptivity = routineAdaptivity(routine);

  const tasks: Omit<Task, "id">[] = [];

  let currentWeekKey = weekKey(startDate, weekStartsOn);
  let weekCounts = new Map<string, number>(seedCounters ?? []);
  const lastUsedDate = new Map<string, string>();

  const capForGroup = (groupId: string) =>
    routine.groups.find((group) => group.id === groupId)?.repetitionCap ?? routine.repetitionCap;

  let d = new Date(startDate);
  while (d.getTime() < endDate.getTime()) {
    const wk = weekKey(d, weekStartsOn);
    if (wk !== currentWeekKey) {
      currentWeekKey = wk;
      weekCounts = new Map<string, number>();
    }

    const dayOfWeek = d.getDay();
    const groupCounts = routine.matrix[String(dayOfWeek)];

    if (groupCounts) {
      const dateStr = dayKey(d);
      const previousDay = dayKey(addDays(d, -1));
      const daySelected: ResolvedPoolItem[] = [];

      for (const [groupId, count] of Object.entries(groupCounts)) {
        if (count <= 0) continue;
        const items = groupItems.get(groupId) ?? [];
        if (!items.length) continue;

        const cap = capForGroup(groupId);
        const available = items.filter((item) => (weekCounts.get(item.key) ?? 0) < cap);
        if (!available.length) continue;

        // Prefer entries not practised the previous day, unless nothing is left.
        const spaced = routine.avoidBackToBack
          ? available.filter((item) => lastUsedDate.get(item.key) !== previousDay)
          : available;
        const pickFrom = spaced.length ? spaced : available;

        const toSelect = Math.min(count, pickFrom.length);
        const weights = buildWeights(pickFrom.map((item) => item.key), stats, adaptivity, dateStr);
        const selected =
          adaptivity === "uniform"
            ? uniformSampleWithoutReplacement(pickFrom, toSelect, rng)
            : weightedSampleWithoutReplacement(pickFrom, toSelect, weights, rng);

        daySelected.push(...selected);
      }

      for (const item of daySelected) {
        weekCounts.set(item.key, (weekCounts.get(item.key) ?? 0) + 1);
        lastUsedDate.set(item.key, dateStr);
      }

      // Merge segment entries sharing a parent item into a single task.
      const segsByItem = new Map<number, { segs: ResolvedPoolItem[]; title: string }>();
      for (const item of daySelected) {
        if (item.type === "segment" && item.itemId !== undefined) {
          const entry = segsByItem.get(item.itemId) ?? { segs: [], title: item.parentTitle ?? item.title };
          entry.segs.push(item);
          segsByItem.set(item.itemId, entry);
        } else {
          tasks.push(buildTask(item, dateStr, routine.subjectId, routine.id, createdAt));
        }
      }
      for (const [itemId, { segs, title }] of segsByItem) {
        tasks.push(buildTask(
          {
            key: `item:${itemId}`,
            type: "item",
            title,
            itemId,
            segmentIds: segs.flatMap((s) => s.segmentIds ?? []),
            linkType: "item",
          },
          dateStr,
          routine.subjectId,
          routine.id,
          createdAt,
        ));
      }
    }

    d = addDays(d, 1);
  }

  return tasks;
}

/** Schedule problems worth showing before a routine is saved. */
export interface RoutineWarning {
  kind: "dayExceedsPool" | "capTooLow";
  day?: number;
  groupName: string;
}

export function collectRoutineWarnings(
  routine: Pick<StudyRoutine, "groups" | "matrix" | "repetitionCap">,
): RoutineWarning[] {
  const warnings: RoutineWarning[] = [];
  for (const [day, counts] of Object.entries(routine.matrix)) {
    for (const [groupId, count] of Object.entries(counts)) {
      const group = routine.groups.find((g) => g.id === groupId);
      if (!group || count <= 0) continue;
      if (count > group.pool.length) {
        warnings.push({ kind: "dayExceedsPool", day: Number(day), groupName: group.name });
      }
    }
  }
  for (const group of routine.groups) {
    const weekly = Object.values(routine.matrix).reduce((sum, counts) => sum + (counts[group.id] ?? 0), 0);
    const cap = group.repetitionCap ?? routine.repetitionCap;
    if (weekly > group.pool.length * cap) {
      warnings.push({ kind: "capTooLow", groupName: group.name });
    }
  }
  return warnings;
}
