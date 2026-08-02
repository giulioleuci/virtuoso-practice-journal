import { db } from "@/infrastructure/dexie/db";
import type { StudyPoolEntry, StudyRoutine, StudyRoutineGenerationPort, StudyRoutineInput, StudyRoutinePort } from "@/domain/ports/studyRoutine";
import { dayKey, getDefaultWeekStartsOn, now, parseDayKey, startOfWeek, endOfWeek, today } from "@/lib/date";
import { confidenceToWeight, generateRoutineTasks, poolEntryKey, type ResolvedPoolItem } from "@/lib/domain/studyRoutineGenerator";

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
      if (segment) { const title = parentTitle.get(segment.itemId) ?? "—"; result.set(key, { key, type: "segment", title: `${title} — ${segment.label}`, parentTitle: title, itemId: segment.itemId, segmentIds: [segment.id], linkType: "item" }); }
    } else {
      const collection = collections.find((row) => row.id === entry.id);
      if (collection) result.set(key, { key, type: "collection", title: collection.name, collectionId: collection.id, linkType: "collection" });
    }
  }
  return result;
}

async function computeWeights(entries: StudyPoolEntry[]) {
  const weights = new Map<string, number>(); let hasHistory = false;
  for (const entry of entries) {
    let confidence: number | null = null;
    if (entry.type === "segment") {
      const key = String(entry.id);
      const values = (await db.sessions.toArray()).filter((session) => session.segmentMetrics?.[key]).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map((session) => session.segmentMetrics?.[key]?.confidence).filter((value): value is number => value !== undefined);
      if (values.length) { confidence = values.reduce((sum, value) => sum + value, 0) / values.length; hasHistory = true; }
    } else if (entry.type === "item") {
      const taskIds = (await db.tasks.where("itemId").equals(entry.id).toArray()).map((task) => task.id).filter((id): id is number => id !== undefined);
      const values = taskIds.length ? (await db.sessions.where("taskId").anyOf(taskIds).toArray()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map((session) => session.confidence).filter((value): value is number => value !== undefined) : [];
      if (values.length) { confidence = values.reduce((sum, value) => sum + value, 0) / values.length; hasHistory = true; }
    }
    weights.set(poolEntryKey(entry), confidenceToWeight(confidence));
  }
  if (!hasHistory) for (const key of weights.keys()) weights.set(key, 4);
  return weights;
}

async function generate(routine: StudyRoutine, fromDate: string, seedCounters?: Map<string, number>) {
  const entries = routine.groups.flatMap((group) => group.pool);
  const pool = await resolvePoolEntries(entries);
  const groups = new Map(routine.groups.map((group) => [group.id, group.pool.map((entry) => pool.get(poolEntryKey(entry))).filter((item): item is ResolvedPoolItem => Boolean(item))]));
  const profile = await db.profile.get("me");
  const weekStartsOn = profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);
  const tasks = generateRoutineTasks(routine, groups, routine.useSpacedRepetition ? await computeWeights(entries) : null, fromDate, now(), seedCounters, weekStartsOn);
  if (tasks.length) await db.tasks.bulkAdd(tasks);
}

export const studyRoutineRepository = {
  async createRoutine(input: StudyRoutineInput, createdAt: number) {
    const id = await db.studyRoutines.add({ ...input, createdAt }) as number;
    return { ...input, id, createdAt };
  },
  resolvePool: resolvePoolEntries,
  weights: computeWeights,
  async weekStartsOn() {
    const profile = await db.profile.get("me");
    return profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);
  },
  async persistTasks(tasks: Omit<import("@/domain/entities/task").Task, "id">[]) {
    if (tasks.length) await db.tasks.bulkAdd(tasks);
  },
  async create(input: StudyRoutineInput) { const id = await db.studyRoutines.add({ ...input, createdAt: now() }) as number; const routine = await db.studyRoutines.get(id); if (routine) await generate(routine, input.startDate); return id; },
  async regenerateFromDate(routine: StudyRoutine, fromDate: string) {
    const future = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => !task.done && task.date >= fromDate).toArray();
    if (future.length) await db.tasks.bulkDelete(future.map((task) => task.id));
    const profile = await db.profile.get("me"); const weekStartsOn = profile?.weekStartsOn ?? (profile ? getDefaultWeekStartsOn(profile.lang) : 1);
    const first = dayKey(startOfWeek(parseDayKey(fromDate), weekStartsOn)); const last = dayKey(endOfWeek(parseDayKey(fromDate), weekStartsOn));
    const completed = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => task.done && task.date >= first && task.date <= last).toArray();
    const counters = new Map<string, number>();
    for (const task of completed) { const keys = task.collectionId ? [`collection:${task.collectionId}`] : task.segmentIds?.length ? task.segmentIds.map((id) => `segment:${id}`) : task.itemId ? [`item:${task.itemId}`] : []; for (const key of keys) counters.set(key, (counters.get(key) ?? 0) + 1); }
    await generate(routine, fromDate, counters);
  },
  async update(id: number, patch: Partial<StudyRoutine>) { await db.studyRoutines.update(id, patch); const routine = await db.studyRoutines.get(id); if (routine) await this.regenerateFromDate(routine, today()); },
  async remove(id: number) { const future = await db.tasks.where("studyRoutineId").equals(id).filter((task) => !task.done && task.date >= today()).toArray(); if (future.length) await db.tasks.bulkDelete(future.map((task) => task.id)); await db.studyRoutines.update(id, { deletedAt: now() }); },
} satisfies StudyRoutinePort & StudyRoutineGenerationPort;
