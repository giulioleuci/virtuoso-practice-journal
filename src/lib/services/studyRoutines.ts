import { db, type Task, type StudyRoutine, type StudyPoolEntry } from "@/lib/db";
import type { StudyRoutineConfig } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolvedPoolItem {
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

// ---------------------------------------------------------------------------
// Date utilities (UTC-safe)
// ---------------------------------------------------------------------------

function parseISODate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

function getMondayOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function getSundayOfWeek(date: Date): Date {
  return addDays(getMondayOfWeek(date), 6);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Pool resolution
// ---------------------------------------------------------------------------

function poolEntryKey(entry: StudyPoolEntry): string {
  return `${entry.type}:${entry.id}`;
}

async function resolvePoolEntries(entries: StudyPoolEntry[]): Promise<Map<string, ResolvedPoolItem>> {
  if (!entries.length) return new Map();

  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    const k = poolEntryKey(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const itemIds = unique.filter((e) => e.type === "item").map((e) => e.id);
  const segIds = unique.filter((e) => e.type === "segment").map((e) => e.id);
  const colIds = unique.filter((e) => e.type === "collection").map((e) => e.id);

  const [items, segments, collections] = await Promise.all([
    itemIds.length ? db.library.where("id").anyOf(itemIds).toArray() : Promise.resolve([]),
    segIds.length ? db.segments.where("id").anyOf(segIds).toArray() : Promise.resolve([]),
    colIds.length ? db.collections.where("id").anyOf(colIds).toArray() : Promise.resolve([]),
  ]);

  const parentIds = [...new Set(segments.map((s) => s.itemId))];
  const parents = parentIds.length
    ? await db.library.where("id").anyOf(parentIds).toArray()
    : [];
  const parentTitleMap = new Map(parents.map((i) => [i.id!, i.title]));

  const result = new Map<string, ResolvedPoolItem>();

  for (const entry of unique) {
    const key = poolEntryKey(entry);
    if (entry.type === "item") {
      const item = items.find((i) => i.id === entry.id);
      if (item) result.set(key, { key, type: "item", title: item.title, itemId: item.id!, linkType: "item" });
    } else if (entry.type === "segment") {
      const seg = segments.find((s) => s.id === entry.id);
      if (seg) {
        const parentTitle = parentTitleMap.get(seg.itemId) ?? "—";
        result.set(key, {
          key, type: "segment",
          title: `${parentTitle} — ${seg.label}`,
          parentTitle,
          itemId: seg.itemId,
          segmentIds: [seg.id!],
          linkType: "item",
        });
      }
    } else {
      const col = collections.find((c) => c.id === entry.id);
      if (col) result.set(key, { key, type: "collection", title: col.name, collectionId: col.id!, linkType: "collection" });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Confidence → weight (Phase 3)
// ---------------------------------------------------------------------------

function confidenceToWeight(avg: number | null): number {
  if (avg === null) return 3;
  if (avg <= 1.5) return 5;
  if (avg <= 2.5) return 4;
  if (avg <= 3.5) return 3;
  if (avg <= 4.5) return 2;
  return 1;
}

async function computeWeights(entries: StudyPoolEntry[]): Promise<Map<string, number>> {
  const weights = new Map<string, number>();
  let anyHasHistory = false;

  for (const entry of entries) {
    const key = poolEntryKey(entry);
    let avg: number | null = null;

    if (entry.type === "segment") {
      const segIdStr = String(entry.id);
      const all = await db.sessions.toArray();
      const relevant = all
        .filter((s) => s.segmentMetrics?.[segIdStr] !== undefined)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);
      const confidences = relevant
        .map((s) => s.segmentMetrics![segIdStr].confidence)
        .filter((c): c is number => c !== undefined);
      if (confidences.length) {
        avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        anyHasHistory = true;
      }
    } else if (entry.type === "item") {
      const tasks = await db.tasks.where("itemId").equals(entry.id).toArray();
      if (tasks.length) {
        const taskIds = tasks.map((t) => t.id!).filter(Boolean);
        const allSessions = await db.sessions.where("taskId").anyOf(taskIds).toArray();
        const sessions = allSessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
        const confidences = sessions
          .map((s) => s.confidence)
          .filter((c): c is number => c !== undefined);
        if (confidences.length) {
          avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
          anyHasHistory = true;
        }
      }
    }

    weights.set(key, confidenceToWeight(avg));
  }

  if (!anyHasHistory) {
    for (const key of weights.keys()) weights.set(key, 4);
  }

  return weights;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

function weightedSampleWithoutReplacement(
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

function uniformSampleWithoutReplacement(items: ResolvedPoolItem[], count: number): ResolvedPoolItem[] {
  if (count >= items.length) return [...items];
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// ---------------------------------------------------------------------------
// Task building
// ---------------------------------------------------------------------------

function buildTask(
  item: ResolvedPoolItem,
  date: string,
  subjectId: number,
  routineId: number,
  now: number,
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
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

async function generate(
  routine: StudyRoutine,
  fromDate: string,
  seedCounters?: Map<string, number>,
): Promise<void> {
  const startDate = parseISODate(fromDate);
  const endDate = addDays(startDate, routine.weeksAhead * 7);

  const allEntries = routine.groups.flatMap((g) => g.pool);
  const poolData = await resolvePoolEntries(allEntries);

  const groupItems = new Map<string, ResolvedPoolItem[]>();
  for (const group of routine.groups) {
    const items = group.pool
      .map((e) => poolData.get(poolEntryKey(e)))
      .filter(Boolean) as ResolvedPoolItem[];
    groupItems.set(group.id, items);
  }

  let weights: Map<string, number> | null = null;
  if (routine.useSpacedRepetition) {
    weights = await computeWeights(allEntries);
  }

  const tasks: Omit<Task, "id">[] = [];
  const now = Date.now();

  let currentWeekKey = getWeekKey(startDate);
  let weekCounts = new Map<string, number>(seedCounters ?? []);

  let d = new Date(startDate);
  while (d.getTime() < endDate.getTime()) {
    const weekKey = getWeekKey(d);
    if (weekKey !== currentWeekKey) {
      currentWeekKey = weekKey;
      weekCounts = new Map<string, number>();
    }

    const dayOfWeek = d.getUTCDay();
    const groupCounts = routine.matrix[String(dayOfWeek)];

    if (groupCounts) {
      const dateStr = formatDate(d);

      // Collect all sampled items across groups for this day
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

      // Update repetition counts per original sampled entry (segment-level tracking)
      for (const item of daySelected) {
        weekCounts.set(item.key, (weekCounts.get(item.key) ?? 0) + 1);
      }

      // Group segment entries sharing the same parent item into a single task
      const segsByItem = new Map<number, { segs: ResolvedPoolItem[]; title: string }>();
      for (const item of daySelected) {
        if (item.type === "segment" && item.itemId !== undefined) {
          const entry = segsByItem.get(item.itemId) ?? { segs: [], title: item.parentTitle ?? item.title };
          entry.segs.push(item);
          segsByItem.set(item.itemId, entry);
        } else {
          tasks.push(buildTask(item, dateStr, routine.subjectId, routine.id!, now));
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
          routine.id!,
          now,
        ));
      }
    }

    d = addDays(d, 1);
  }

  if (tasks.length) {
    await db.tasks.bulkAdd(tasks);
  }
}

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export const studyRoutinesService = {
  async create(config: StudyRoutineConfig): Promise<number> {
    const now = Date.now();
    const routineId = (await db.studyRoutines.add({
      name: config.name,
      subjectId: config.subjectId,
      groups: config.groups as StudyRoutine["groups"],
      matrix: config.matrix,
      weeksAhead: config.weeksAhead,
      repetitionCap: config.repetitionCap,
      useSpacedRepetition: config.useSpacedRepetition,
      startDate: config.startDate,
      createdAt: now,
    })) as number;

    const routine = await db.studyRoutines.get(routineId);
    if (routine) await generate(routine, config.startDate);

    return routineId;
  },

  async regenerateFromDate(routine: StudyRoutine, fromDateStr: string): Promise<void> {
    const toDelete = await db.tasks
      .where("studyRoutineId")
      .equals(routine.id!)
      .filter((t) => !t.done && t.date >= fromDateStr)
      .toArray();

    if (toDelete.length) {
      await db.tasks.bulkDelete(toDelete.map((t) => t.id!));
    }

    const mondayStr = formatDate(getMondayOfWeek(parseISODate(fromDateStr)));
    const sundayStr = formatDate(getSundayOfWeek(parseISODate(fromDateStr)));

    const completedThisWeek = await db.tasks
      .where("studyRoutineId")
      .equals(routine.id!)
      .filter((t) => t.done && t.date >= mondayStr && t.date <= sundayStr)
      .toArray();

    const seedCounters = new Map<string, number>();
    for (const task of completedThisWeek) {
      if (task.collectionId) {
        const key = `collection:${task.collectionId}`;
        seedCounters.set(key, (seedCounters.get(key) ?? 0) + 1);
      } else if (task.segmentIds?.length) {
        // Each segment in a merged task counts as one occurrence for that segment
        for (const segId of task.segmentIds) {
          const key = `segment:${segId}`;
          seedCounters.set(key, (seedCounters.get(key) ?? 0) + 1);
        }
      } else if (task.itemId) {
        const key = `item:${task.itemId}`;
        seedCounters.set(key, (seedCounters.get(key) ?? 0) + 1);
      }
    }

    await generate(routine, fromDateStr, seedCounters);
  },

  async update(routineId: number, patch: Partial<StudyRoutine>): Promise<void> {
    await db.studyRoutines.update(routineId, patch);
    const routine = await db.studyRoutines.get(routineId);
    if (!routine) return;
    await studyRoutinesService.regenerateFromDate(routine, todayStr());
  },

  /** Delete a routine and all its future undone tasks. Past + done tasks are preserved. */
  async remove(routineId: number): Promise<void> {
    const today = todayStr();
    const futureUndone = await db.tasks
      .where("studyRoutineId")
      .equals(routineId)
      .filter((t) => !t.done && t.date >= today)
      .toArray();
    if (futureUndone.length) {
      await db.tasks.bulkDelete(futureUndone.map((t) => t.id!));
    }
    await db.studyRoutines.update(routineId, { deletedAt: Date.now() });
  },
};
