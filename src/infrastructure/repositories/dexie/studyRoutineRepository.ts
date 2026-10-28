import { taskRepository } from "./taskRepository";
import { tempoProgressionRepository } from "./tempoProgressionRepository";
import { tempoRuleSchema } from "@/lib/schemas";
import { db } from "@/infrastructure/dexie/db";
import type { Task } from "@/domain/entities/task";
import type {
  StudyPoolEntry,
  StudyPoolStat,
  StudyRoutine,
  StudyRoutineGenerationPort,
  StudyRoutineInput,
  StudyRoutinePort,
} from "@/domain/ports/studyRoutine";
import { dayKey, getDefaultWeekStartsOn, now, parseDayKey, startOfWeek, endOfWeek, today } from "@/lib/date";
import { planSegmentIds, syncPlan } from "@/domain/logic/plan";
import { meanConfidence } from "@/domain/logic/sessionMetrics";
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
  const itemSegments = ids("item").length ? await db.segments.where("itemId").anyOf(ids("item")).filter((segment) => !segment.deletedAt).toArray() : [];
  const parentIds = [...new Set(segments.map((segment) => segment.itemId))];
  const parents = parentIds.length ? await db.library.where("id").anyOf(parentIds).toArray() : [];
  const parentById = new Map(parents.map(item => [item.id, item]));
  const result = new Map<string, ResolvedPoolItem>();
  for (const entry of unique) {
    const key = poolEntryKey(entry);
    if (entry.type === "item") {
      const item = items.find((row) => row.id === entry.id);
      if (item && !item.deletedAt) {
        const sections = itemSegments.filter((segment) => segment.itemId === item.id).map((segment): ResolvedPoolItem => ({
          key: `segment:${segment.id}`, type: "segment", title: `${item.title} — ${segment.label}`, parentTitle: item.title, itemId: item.id, segmentIds: [segment.id], plan: syncPlan([], [segment], item), linkType: "item",
        }));
        result.set(key, { key, type: "item", title: item.title, itemId: item.id, linkType: "item", plan: syncPlan([], [], item), sections });
      }
    } else if (entry.type === "segment") {
      const segment = segments.find((row) => row.id === entry.id);
      const parent = segment && parentById.get(segment.itemId);
      if (segment && !segment.deletedAt && parent && !parent.deletedAt) {
        const title = parent.title;
        result.set(key, { key, type: "segment", title: `${title} — ${segment.label}`, parentTitle: title, itemId: segment.itemId, segmentIds: [segment.id], plan: syncPlan([], [segment], parent), linkType: "item" });
      }
    } else {
      const collection = collections.find((row) => row.id === entry.id);
      if (collection && !collection.deletedAt) result.set(key, { key, type: "collection", title: collection.name, collectionId: collection.id, linkType: "collection" });
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

  const sessions = await db.sessions.toArray();

  const byItem = new Map<number, { confidence?: number; date: string; createdAt: number }[]>();
  const byCollection = new Map<number, { confidence?: number; date: string; createdAt: number }[]>();
  const bySegment = new Map<number, { confidence?: number; date: string; createdAt: number }[]>();

  for (const session of sessions) {
    const row = { confidence: meanConfidence(session.marks), date: session.date, createdAt: session.createdAt };
    if (session.itemId !== undefined) byItem.set(session.itemId, [...(byItem.get(session.itemId) ?? []), row]);
    if (session.collectionId !== undefined) byCollection.set(session.collectionId, [...(byCollection.get(session.collectionId) ?? []), row]);
    for (const mark of session.marks) {
      if (mark.segmentId === undefined) continue;
      bySegment.set(mark.segmentId, [...(bySegment.get(mark.segmentId) ?? []), { confidence: mark.confidence, date: session.date, createdAt: session.createdAt }]);
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

const slotKey = (task: Pick<Task, "date" | "itemId" | "collectionId" | "title">) => `${task.date}|${task.itemId ?? ""}|${task.collectionId ?? ""}|${task.itemId ?? task.collectionId ? "" : task.title}`;

async function generate(routine: StudyRoutine, fromDate: string, seedCounters?: Map<string, number>, kept: Pick<Task, "date" | "itemId" | "collectionId" | "title">[] = []) {
  return db.transaction("rw", db.tables, async () => {
  routine = await db.studyRoutines.get(routine.id);
  if (!routine || routine.deletedAt) return;
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
    tempoProgressions: await db.tempoProgressions.where("[owner.kind+owner.id]").equals(["routine",routine.id]).toArray(),
  });
  // ponytail: a kept task only suppresses the identical draw on its day; a different draw still lands beside it. Make generation slot-aware if days feel crowded.
  // Any task the routine still has from fromDate on (done today, customized, or left by an earlier run) blocks the same draw.
  const existing = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => !task.deletedAt && task.date >= fromDate).toArray();
  const taken = new Set([...kept, ...existing].map(slotKey));
  const fresh = tasks.filter((task) => !taken.has(slotKey(task)));
  if (fresh.length) await db.tasks.bulkAdd(fresh);
  });
}

const locks = new Map<number, Promise<void>>();

async function regenerate(routine: StudyRoutine, fromDate: string) {
  return db.transaction("rw", db.tables, async () => {
  routine = await db.studyRoutines.get(routine.id);
  if (!routine || routine.deletedAt) return;
  const future = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => !task.done && task.date >= fromDate).toArray();
  const studied = new Set(await db.sessions.where("taskId").anyOf(future.map(t => t.id!)).uniqueKeys() as number[]);
  const replaceable = future.filter((task) => !task.customized && !studied.has(task.id!));
  // Customized copies sharing a slot (left by earlier duplicate runs) collapse to one.
  const seen = new Set<string>();
  for (const task of future.filter((t) => t.customized)) { if (seen.has(slotKey(task))) replaceable.push(task); else seen.add(slotKey(task)); }
  if (replaceable.length) await db.tasks.bulkDelete(replaceable.map((task) => task.id));
  const weekStartsOn = await profileWeekStartsOn();
  const first = dayKey(startOfWeek(parseDayKey(fromDate), weekStartsOn));
  const last = dayKey(endOfWeek(parseDayKey(fromDate), weekStartsOn));
  const completed = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => task.done && task.date >= first && task.date <= last).toArray();
  const counters = new Map<string, number>();
  for (const task of completed) {
    const keys = task.collectionId ? [`collection:${task.collectionId}`] : planSegmentIds(task.plan).length ? planSegmentIds(task.plan).map((id) => `segment:${id}`) : task.itemId ? [`item:${task.itemId}`] : [];
    for (const key of keys) counters.set(key, (counters.get(key) ?? 0) + 1);
}
  await generate(routine, fromDate, counters, future.filter((task) => task.customized && !replaceable.includes(task)));
  });
}

export const studyRoutineRepository = {
  async createRoutine(input: StudyRoutineInput, createdAt: number) {
    if (input.tempoRule) tempoRuleSchema.parse(input.tempoRule);
    const id = await db.studyRoutines.add({ ...input, tempoRuleRevision: input.tempoRule ? 1 : undefined, createdAt }) as number;
    return { ...input, tempoRuleRevision: input.tempoRule ? 1 : undefined, id, createdAt };
  },
  resolvePool: resolvePoolEntries,
  stats: computeStats,
  weekStartsOn: profileWeekStartsOn,
  async persistTasks(tasks: Omit<import("@/domain/entities/task").Task, "id">[]) {
    if (!tasks.length) return;
    await db.tasks.bulkAdd(tasks);
  },
  async create(input: StudyRoutineInput) {
    const id = await db.studyRoutines.add({ ...input, tempoRuleRevision: input.tempoRule ? 1 : undefined, createdAt: now() }) as number;
    const routine = await db.studyRoutines.get(id);
    if (routine) await generate(routine, input.startDate);
    return id;
  },
  regenerateFromDate(routine: StudyRoutine, fromDate: string) {
    // Serialized per routine: overlapping runs would each delete then each add, duplicating the plan.
    const run = (locks.get(routine.id) ?? Promise.resolve()).catch(() => undefined).then(() => regenerate(routine, fromDate));
    locks.set(routine.id, run);
    return run;
  },
  async update(id: number, patch: Partial<StudyRoutine>) {
    await db.transaction("rw", [db.studyRoutines, db.tempoProgressions, db.tasks, db.sessions, db.segments, db.library], async () => {
      if ("tempoRule" in patch) await tempoProgressionRepository.configure({ kind: "routine", id },patch.tempoRule,now());
      const { tempoRule: _rule, tempoRuleRevision: _revision, ...fields } = patch;
      await db.studyRoutines.update(id,fields);
    });
    const routine = await db.studyRoutines.get(id);
    if (routine) await this.regenerateFromDate(routine, today());
  },
  async remove(id: number) {
    const future = await db.tasks.where("studyRoutineId").equals(id).filter((task) => !task.done && task.date >= today()).toArray();
    if (future.length) await taskRepository.bulkRemove(future.map(task => task.id!));
    await db.studyRoutines.update(id, { deletedAt: now() });
  },
} satisfies StudyRoutinePort & StudyRoutineGenerationPort;
