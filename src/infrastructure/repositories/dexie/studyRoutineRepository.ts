import { db } from "@/infrastructure/dexie/db";
import type {
  StudyPoolEntry,
  StudyPoolStat,
  StudyRoutine,
  StudyRoutineGenerationPort,
  StudyRoutineInput,
  StudyRoutinePort,
} from "@/domain/ports/studyRoutine";
import { dayKey, getDefaultWeekStartsOn, now, parseDayKey, startOfWeek, endOfWeek, today } from "@/lib/date";
import {
  decayedAverage,
  generateRoutineTasks,
  poolEntryKey,
  routineAdaptivity,
  type ResolvedPoolItem,
} from "@/lib/domain/studyRoutineGenerator";

async function resolvePoolEntries(entries: StudyPoolEntry[]): Promise<Map<string, ResolvedPoolItem>> {
  const unique = [...new Map(entries.map((entry) => [poolEntryKey(entry), entry])).values()];
  const ids = (type: StudyPoolEntry["type"]) => unique.filter((entry) => entry.type === type).map((entry) => entry.id);
  const [items, segments, collections] = await Promise.all([
    ids("item").length ? db.library.where("id").anyOf(ids("item")).toArray() : [],
    ids("segment").length ? db.segments.where("id").anyOf(ids("segment")).toArray() : [],
    ids("collection").length ? db.collections.where("id").anyOf(ids("collection")).toArray() : [],
  ]);
  const parentIds = [...new Set(segments.map((segment) => segment.itemId))];
  const parents = parentIds.length ? await db.library.where("id").anyOf(parentIds).toArray() : [];
  const parentTitle = new Map(parents.map((item) => [item.id, item.title]));
  const result = new Map<string, ResolvedPoolItem>();
  for (const entry of unique) {
    const key = poolEntryKey(entry);
    if (entry.type === "item") {
      const item = items.find((row) => row.id === entry.id);
      if (item) result.set(key, { key, type: "item", title: item.title, itemId: item.id, linkType: "item" });
    } else if (entry.type === "segment") {
      const segment = segments.find((row) => row.id === entry.id);
      if (segment) {
        const title = parentTitle.get(segment.itemId) ?? "—";
        result.set(key, { key, type: "segment", title: `${title} — ${segment.label}`, parentTitle: title, itemId: segment.itemId, segmentIds: [segment.id], linkType: "item" });
      }
    } else {
      const collection = collections.find((row) => row.id === entry.id);
      if (collection) result.set(key, { key, type: "collection", title: collection.name, collectionId: collection.id, linkType: "collection" });
    }
  }
  return result;
}

const RECENT_SESSIONS = 8;

function statFrom(rows: { confidence?: number; date: string; createdAt: number }[]): StudyPoolStat {
  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);
  const values = sorted.map((row) => row.confidence).filter((value): value is number => value !== undefined).slice(0, RECENT_SESSIONS);
  return {
    confidence: decayedAverage(values),
    lastPracticed: sorted[0]?.date,
    sessions: sorted.length,
  };
}

/**
 * Practice history per pool entry: recency-weighted confidence plus the last
 * practice date. Reads sessions and tasks once, not once per entry.
 */
async function computeStats(entries: StudyPoolEntry[]): Promise<Map<string, StudyPoolStat>> {
  const unique = [...new Map(entries.map((entry) => [poolEntryKey(entry), entry])).values()];
  const stats = new Map<string, StudyPoolStat>();
  if (!unique.length) return stats;

  const [sessions, tasks] = await Promise.all([db.sessions.toArray(), db.tasks.toArray()]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const byItem = new Map<number, { confidence?: number; date: string; createdAt: number }[]>();
  const byCollection = new Map<number, { confidence?: number; date: string; createdAt: number }[]>();
  const bySegment = new Map<number, { confidence?: number; date: string; createdAt: number }[]>();

  for (const session of sessions) {
    const task = taskById.get(session.taskId);
    const row = { confidence: session.confidence, date: session.date, createdAt: session.createdAt };
    if (task?.itemId !== undefined) {
      byItem.set(task.itemId, [...(byItem.get(task.itemId) ?? []), row]);
    }
    if (task?.collectionId !== undefined) {
      byCollection.set(task.collectionId, [...(byCollection.get(task.collectionId) ?? []), row]);
    }
    for (const [segmentId, metric] of Object.entries(session.segmentMetrics ?? {})) {
      const id = Number(segmentId);
      if (!Number.isFinite(id)) continue;
      bySegment.set(id, [...(bySegment.get(id) ?? []), { confidence: metric?.confidence, date: session.date, createdAt: session.createdAt }]);
    }
  }

  const collectionIds = unique.filter((entry) => entry.type === "collection").map((entry) => entry.id);
  const members = collectionIds.length
    ? await db.collectionItems.where("collectionId").anyOf(collectionIds).toArray()
    : [];

  for (const entry of unique) {
    const key = poolEntryKey(entry);
    if (entry.type === "item") {
      stats.set(key, statFrom(byItem.get(entry.id) ?? []));
    } else if (entry.type === "segment") {
      stats.set(key, statFrom(bySegment.get(entry.id) ?? []));
    } else {
      // A collection inherits the history of its own tasks plus that of its pieces.
      const memberRows = members
        .filter((member) => member.collectionId === entry.id)
        .flatMap((member) => byItem.get(member.itemId) ?? []);
      stats.set(key, statFrom([...(byCollection.get(entry.id) ?? []), ...memberRows]));
    }
  }
  return stats;
}

async function profileWeekStartsOn() {
  const profile = await db.profile.get("me");
  return profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);
}

async function generate(routine: StudyRoutine, fromDate: string, seedCounters?: Map<string, number>) {
  const entries = routine.groups.flatMap((group) => group.pool);
  const pool = await resolvePoolEntries(entries);
  const groupItems = new Map(
    routine.groups.map((group) => [
      group.id,
      group.pool.map((entry) => pool.get(poolEntryKey(entry))).filter((item): item is ResolvedPoolItem => Boolean(item)),
    ]),
  );
  const tasks = generateRoutineTasks({
    routine,
    groupItems,
    stats: routineAdaptivity(routine) === "uniform" ? null : await computeStats(entries),
    fromDate,
    createdAt: now(),
    seedCounters,
    weekStartsOn: await profileWeekStartsOn(),
  });
  if (tasks.length) await db.tasks.bulkAdd(tasks);
}

export const studyRoutineRepository = {
  async createRoutine(input: StudyRoutineInput, createdAt: number) {
    const id = await db.studyRoutines.add({ ...input, createdAt }) as number;
    return { ...input, id, createdAt };
  },
  resolvePool: resolvePoolEntries,
  stats: computeStats,
  weekStartsOn: profileWeekStartsOn,
  async persistTasks(tasks: Omit<import("@/domain/entities/task").Task, "id">[]) {
    if (tasks.length) await db.tasks.bulkAdd(tasks);
  },
  async create(input: StudyRoutineInput) {
    const id = await db.studyRoutines.add({ ...input, createdAt: now() }) as number;
    const routine = await db.studyRoutines.get(id);
    if (routine) await generate(routine, input.startDate);
    return id;
  },
  async regenerateFromDate(routine: StudyRoutine, fromDate: string) {
    const future = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => !task.done && task.date >= fromDate).toArray();
    if (future.length) await db.tasks.bulkDelete(future.map((task) => task.id));
    const weekStartsOn = await profileWeekStartsOn();
    const first = dayKey(startOfWeek(parseDayKey(fromDate), weekStartsOn));
    const last = dayKey(endOfWeek(parseDayKey(fromDate), weekStartsOn));
    const completed = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => task.done && task.date >= first && task.date <= last).toArray();
    const counters = new Map<string, number>();
    for (const task of completed) {
      const keys = task.collectionId ? [`collection:${task.collectionId}`] : task.segmentIds?.length ? task.segmentIds.map((id) => `segment:${id}`) : task.itemId ? [`item:${task.itemId}`] : [];
      for (const key of keys) counters.set(key, (counters.get(key) ?? 0) + 1);
    }
    await generate(routine, fromDate, counters);
  },
  async update(id: number, patch: Partial<StudyRoutine>) {
    await db.studyRoutines.update(id, patch);
    const routine = await db.studyRoutines.get(id);
    if (routine) await this.regenerateFromDate(routine, today());
  },
  async remove(id: number) {
    const future = await db.tasks.where("studyRoutineId").equals(id).filter((task) => !task.done && task.date >= today()).toArray();
    if (future.length) await db.tasks.bulkDelete(future.map((task) => task.id));
    await db.studyRoutines.update(id, { deletedAt: now() });
  },
} satisfies StudyRoutinePort & StudyRoutineGenerationPort;
