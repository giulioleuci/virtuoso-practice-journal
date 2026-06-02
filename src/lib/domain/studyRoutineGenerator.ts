/** Pure study-routine task generation: pool keys, weighting, sampling, day loop.
 *
 * No Dexie access — the service resolves pool entries and computes weights from
 * the DB, then hands the resolved inputs here to produce the concrete tasks.
 */
import type { StudyPoolEntry, StudyRoutine, Task } from "@/lib/db";
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

export function weightedSampleWithoutReplacement(
  items: ResolvedPoolItem[],
  count: number,
  weights: Map<string, number>,
): ResolvedPoolItem[] {
  if (count >= items.length) return [...items];
  const remaining = [...items];
  const selected: ResolvedPoolItem[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const total = remaining.reduce((sum, item) => sum + (weights.get(item.key) ?? 3), 0);
    let r = Math.random() * total;
    let idx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      r -= weights.get(remaining[j].key) ?? 3;
      if (r <= 0) { idx = j; break; }
    }
    selected.push(...remaining.splice(idx, 1));
  }

  return selected;
}

export function uniformSampleWithoutReplacement(items: ResolvedPoolItem[], count: number): ResolvedPoolItem[] {
  if (count >= items.length) return [...items];
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
    segmentIds: item.segmentIds,
    collectionId: item.collectionId,
    title: item.title,
    done: false,
    studyRoutineId: routineId,
    createdAt,
  };
}

/**
 * Generate the concrete tasks for a routine over its horizon, given resolved
 * pool items per group and (optionally) spaced-repetition weights. Pure: no DB.
 */
export function generateRoutineTasks(
  routine: StudyRoutine,
  groupItems: Map<string, ResolvedPoolItem[]>,
  weights: Map<string, number> | null,
  fromDate: string,
  createdAt: number,
  seedCounters?: Map<string, number>,
  weekStartsOn: number = 1,
): Omit<Task, "id">[] {
  const startDate = parseDayKey(fromDate);
  const endDate = addDays(startDate, routine.weeksAhead * 7);

  const tasks: Omit<Task, "id">[] = [];

  let currentWeekKey = weekKey(startDate, weekStartsOn);
  let weekCounts = new Map<string, number>(seedCounters ?? []);

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
      const daySelected: ResolvedPoolItem[] = [];

      for (const [groupId, count] of Object.entries(groupCounts)) {
        if (count <= 0) continue;
        const items = groupItems.get(groupId) ?? [];
        if (!items.length) continue;

        const available = items.filter(
          (item) => (weekCounts.get(item.key) ?? 0) < routine.repetitionCap,
        );
        if (!available.length) continue;

        const toSelect = Math.min(count, available.length);
        const selected =
          routine.useSpacedRepetition && weights
            ? weightedSampleWithoutReplacement(available, toSelect, weights)
            : uniformSampleWithoutReplacement(available, toSelect);

        daySelected.push(...selected);
      }

      for (const item of daySelected) {
        weekCounts.set(item.key, (weekCounts.get(item.key) ?? 0) + 1);
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
