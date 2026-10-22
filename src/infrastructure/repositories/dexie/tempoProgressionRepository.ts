import { db } from "@/infrastructure/dexie/db";
import type { TempoOwnerData, TempoProgressionPort, TempoProgressionTransaction } from "@/domain/ports/tempoProgression";
import type { TempoContext, TempoObservation, TempoOwner, TempoProgressionRule } from "@/domain/entities/tempoProgression";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { planTempoUpdates, resolveTempoContext, tempoContextKey } from "@/domain/logic/tempoProgression";
import { tempoRuleSchema } from "@/lib/schemas";
import { dayKey } from "@/lib/date";

const tables = () => [db.tempoProgressions, db.studyRoutines, db.tasks, db.sessions, db.segments, db.library];
async function observations(sessions: Session[], tasks: Task[]): Promise<TempoObservation[]> {
  const ids = [...new Set(sessions.flatMap(s => s.marks.flatMap(m => m.segmentId === undefined ? [] : [m.segmentId])))];
  const segments = ids.length ? await db.segments.where("id").anyOf(ids).toArray() : [];
  return sessions.flatMap(session => session.marks.flatMap(mark => {
    const task = tasks.find(t => t.id === session.taskId);
    // Session-owned content survives task edits; sections resolve their own material.
    const target = { ...task, itemId: session.subjectId === undefined ? session.itemId ?? task?.itemId : session.itemId } as Task;
    const context = resolveTempoContext(target, mark, segments);
    return context ? [{ sessionId: session.id, taskId: session.taskId, date: session.date, createdAt: session.createdAt, context, mark }] : [];
  }));
}
async function read(owner: TempoOwner): Promise<TempoOwnerData> {
  const root = owner.kind === "routine" ? await db.studyRoutines.get(owner.id) : await db.tasks.get(owner.id);
  if (!root || (owner.kind === "recurrence" && (!(root as Task).recurrence || (root as Task).recurrenceTaskId !== undefined))) throw new Error("Tempo progression owner is missing");
  const states = await db.tempoProgressions.where("[owner.kind+owner.id]").equals([owner.kind,owner.id]).toArray();
  const tasks = owner.kind === "routine" ? await db.tasks.where("studyRoutineId").equals(owner.id).toArray() : [root as Task, ...await db.tasks.where("recurrenceTaskId").equals(owner.id).toArray()];
  const taskIds = tasks.flatMap(t => t.id === undefined ? [] : [t.id]);
  const sessions = [...new Map([
    ...(states.length ? await db.sessions.where("tempoProgressionIds").anyOf(states.map(s => s.id)).toArray() : []),
    ...(taskIds.length ? await db.sessions.where("taskId").anyOf(taskIds).toArray() : []),
  ].map(s => [s.id,s])).values()];
  const segmentIds = [...new Set([...tasks.flatMap(t => t.plan.flatMap(e => e.segmentId === undefined ? [] : [e.segmentId])), ...states.flatMap(s => s.context.segmentId === undefined ? [] : [s.context.segmentId])])];
  const segments = segmentIds.length ? await db.segments.where("id").anyOf(segmentIds).toArray() : [];
  const itemIds = [...new Set([...tasks.flatMap(t => t.itemId === undefined ? [] : [t.itemId]), ...segments.map(s => s.itemId), ...states.map(s => s.context.itemId)])];
  const items = itemIds.length ? await db.library.where("id").anyOf(itemIds).toArray() : [];
  return { owner, rule: root.tempoRule, ruleRevision: root.tempoRuleRevision ?? 0, states, tasks, segments, items, observations: await observations(sessions,tasks) };
}
async function history(context: TempoContext): Promise<TempoObservation[]> {
  const segments = await db.segments.where("itemId").equals(context.itemId).toArray();
  const tasks = await db.tasks.where("itemId").equals(context.itemId).toArray();
  // Combined tasks are found through their section index on session marks.
  const sessions = [...new Map([
    ...await db.sessions.where("itemId").equals(context.itemId).toArray(),
    ...(tasks.length ? await db.sessions.where("taskId").anyOf(tasks.map(t => t.id!)).toArray() : []),
    ...(segments.length ? await db.sessions.where("tempoSegmentIds").anyOf(segments.map(s => s.id)).toArray() : []),
  ].map(s => [s.id,s])).values()];
  return (await observations(sessions,tasks)).filter(o => tempoContextKey(o.context) === tempoContextKey(context));
}
const tx: TempoProgressionTransaction = {
  read, history,
  putState: state => db.tempoProgressions.put(state) as Promise<number>,
  putPlan: async (taskId, plan) => { if (!await db.tasks.update(taskId, { plan })) throw new Error("Task disappeared"); },
};
export const tempoProgressionRepository: TempoProgressionPort = {
  read, history,
  transaction: operation => db.transaction("rw", tables(), async () => await operation(tx)),
  async configure(owner, rule, at) {
    if (rule !== undefined) tempoRuleSchema.parse(rule);
    await db.transaction("rw", tables(), async () => {
      const data = await read(owner);
      if (JSON.stringify(data.rule) === JSON.stringify(rule)) return;
      const revision = data.ruleRevision+1;
      if (owner.kind === "routine") await db.studyRoutines.update(owner.id, { tempoRule: rule, tempoRuleRevision: revision });
      else await db.tasks.update(owner.id, { tempoRule: rule, tempoRuleRevision: revision });
      for (const state of data.states) {
        const next = { ...state, cycle: state.cycle+1, startedAt: at, ruleRevision: revision };
        await tx.putState(next);
        if (!rule?.enabled) continue;
        const { updates } = planTempoUpdates({ ...data, context: state.context, tempo: state.tempo, reference: { id: state.id, cycle: next.cycle, minConfidence: rule.minConfidence }, fromDate: dayKey(new Date(at)) });
        for (const update of updates) {
          await tx.putPlan(update.taskId,update.plan);
          const task = data.tasks.find(t => t.id === update.taskId);
          if (task) task.plan = update.plan;
        }
      }
    });
  },
};
