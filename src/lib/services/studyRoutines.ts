import { db, type StudyRoutine, type StudyPoolEntry } from "@/lib/db";
import type { StudyRoutineConfig } from "@/lib/schemas";
import { dayKey, today, parseDayKey, startOfWeek, endOfWeek, now, getDefaultWeekStartsOn } from "@/lib/date";
import {
  poolEntryKey,
  confidenceToWeight,
  generateRoutineTasks,
  type ResolvedPoolItem,
} from "@/lib/domain/studyRoutineGenerator";

// ---------------------------------------------------------------------------
// Pool resolution (DB IO)
// ---------------------------------------------------------------------------

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
  const parentTitleMap = new Map(parents.map((i) => [i.id, i.title]));

  const result = new Map<string, ResolvedPoolItem>();

  for (const entry of unique) {
    const key = poolEntryKey(entry);
    if (entry.type === "item") {
      const item = items.find((i) => i.id === entry.id);
      if (item) result.set(key, { key, type: "item", title: item.title, itemId: item.id, linkType: "item" });
    } else if (entry.type === "segment") {
      const seg = segments.find((s) => s.id === entry.id);
      if (seg) {
        const parentTitle = parentTitleMap.get(seg.itemId) ?? "—";
        result.set(key, {
          key, type: "segment",
          title: `${parentTitle} — ${seg.label}`,
          parentTitle,
          itemId: seg.itemId,
          segmentIds: [seg.id],
          linkType: "item",
        });
      }
    } else {
      const col = collections.find((c) => c.id === entry.id);
      if (col) result.set(key, { key, type: "collection", title: col.name, collectionId: col.id, linkType: "collection" });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Spaced-repetition weights (DB IO)
// ---------------------------------------------------------------------------

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
        .map((s) => s.segmentMetrics?.[segIdStr]?.confidence)
        .filter((c): c is number => c !== undefined);
      if (confidences.length) {
        avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        anyHasHistory = true;
      }
    } else if (entry.type === "item") {
      const tasks = await db.tasks.where("itemId").equals(entry.id).toArray();
      if (tasks.length) {
        const taskIds = tasks.map((t) => t.id).filter(Boolean);
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
// Generation orchestration
// ---------------------------------------------------------------------------

async function generate(
  routine: StudyRoutine,
  fromDate: string,
  seedCounters?: Map<string, number>,
): Promise<void> {
  const allEntries = routine.groups.flatMap((g) => g.pool);
  const poolData = await resolvePoolEntries(allEntries);

  const groupItems = new Map<string, ResolvedPoolItem[]>();
  for (const group of routine.groups) {
    const items = group.pool
      .map((e) => poolData.get(poolEntryKey(e)))
      .filter(Boolean) as ResolvedPoolItem[];
    groupItems.set(group.id, items);
  }

  const weights = routine.useSpacedRepetition ? await computeWeights(allEntries) : null;

  const profile = await db.profile.get("me");
  const weekStartsOn = profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);

  const tasks = generateRoutineTasks(routine, groupItems, weights, fromDate, now(), seedCounters, weekStartsOn);
  if (tasks.length) await db.tasks.bulkAdd(tasks);
}

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export const studyRoutinesService = {
  async create(config: StudyRoutineConfig): Promise<number> {
    const routineId = (await db.studyRoutines.add({
      name: config.name,
      subjectId: config.subjectId,
      groups: config.groups as StudyRoutine["groups"],
      matrix: config.matrix,
      weeksAhead: config.weeksAhead,
      repetitionCap: config.repetitionCap,
      useSpacedRepetition: config.useSpacedRepetition,
      startDate: config.startDate,
      createdAt: now(),
    })) as number;

    const routine = await db.studyRoutines.get(routineId);
    if (routine) await generate(routine, config.startDate);

    return routineId;
  },

  async regenerateFromDate(routine: StudyRoutine, fromDateStr: string): Promise<void> {
    const toDelete = await db.tasks
      .where("studyRoutineId")
      .equals(routine.id)
      .filter((t) => !t.done && t.date >= fromDateStr)
      .toArray();

    if (toDelete.length) {
      await db.tasks.bulkDelete(toDelete.map((t) => t.id));
    }

    const profile = await db.profile.get("me");
    const weekStartsOn = profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);

    const startOfWeekStr = dayKey(startOfWeek(parseDayKey(fromDateStr), weekStartsOn));
    const endOfWeekStr = dayKey(endOfWeek(parseDayKey(fromDateStr), weekStartsOn));

    const completedThisWeek = await db.tasks
      .where("studyRoutineId")
      .equals(routine.id)
      .filter((t) => t.done && t.date >= startOfWeekStr && t.date <= endOfWeekStr)
      .toArray();

    const seedCounters = new Map<string, number>();
    for (const task of completedThisWeek) {
      if (task.collectionId) {
        const key = `collection:${task.collectionId}`;
        seedCounters.set(key, (seedCounters.get(key) ?? 0) + 1);
      } else if (task.segmentIds?.length) {
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
    await studyRoutinesService.regenerateFromDate(routine, today());
  },

  /** Delete a routine and all its future undone tasks. Past + done tasks are preserved. */
  async remove(routineId: number): Promise<void> {
    const todayStr = today();
    const futureUndone = await db.tasks
      .where("studyRoutineId")
      .equals(routineId)
      .filter((t) => !t.done && t.date >= todayStr)
      .toArray();
    if (futureUndone.length) {
      await db.tasks.bulkDelete(futureUndone.map((t) => t.id));
    }
    await db.studyRoutines.update(routineId, { deletedAt: now() });
  },
};
