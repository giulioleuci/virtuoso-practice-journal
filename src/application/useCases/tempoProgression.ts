import type { Tempo } from "@/domain/entities/common";
import type { TempoContext, TempoEvaluation, TempoObservation, TempoOwner, TempoPlanExclusion, TempoPlanUpdate, TempoProgression, TempoProgressionRule, TempoProgressionRef } from "@/domain/entities/tempoProgression";
import type { TempoOwnerData, TempoProgressionPort, TempoProgressionTransaction } from "@/domain/ports/tempoProgression";
import { evaluateTempoProgression, initialTempo, planTempoUpdates, targetEvidence, tempoContextKey } from "@/domain/logic/tempoProgression";
import { bpmSchema, noteValSchema } from "@/lib/schemas";
import { dayKey } from "@/lib/date";
export type TempoChangeRequest = { owner: TempoOwner; context: TempoContext; initialTempo?: Tempo; sourceTaskId?: number };
export type TempoProgressionView = { state?: TempoProgression; rule?: TempoProgressionRule; initial?: TempoObservation; evaluation?: TempoEvaluation; evidence?: TempoObservation };
export type TempoProgressionPreview = { request: TempoChangeRequest; current?: Tempo; proposed: Tempo; expectedCycle?: number; expectedRuleRevision: number; fingerprint: string; updates: TempoPlanUpdate[]; excluded: TempoPlanExclusion[] };
export type TempoAcceptResult = { status: "applied"; state: TempoProgression; reference: TempoProgressionRef } | { status: "stale"; preview: TempoProgressionPreview | null };
const findState = (data: TempoOwnerData, context: TempoContext) => data.states.find(s => s.contextKey === tempoContextKey(context));

export class TempoProgressionUseCase {
  constructor(private readonly repository: TempoProgressionPort, private readonly clock: () => number = Date.now) {}
  async view(owner: TempoOwner, context: TempoContext): Promise<TempoProgressionView> {
    const data = await this.repository.read(owner), state = findState(data,context);
    if (!data.rule?.enabled) return { state, rule: data.rule };
    const initial = state ? undefined : initialTempo(context, await this.repository.history(context), data.rule.minConfidence);
    const segment = data.segments.find(s => s.id === context.segmentId), item = data.items.find(i => i.id === context.itemId);
    const target = segment?.targetBpm !== undefined && segment.noteVal !== undefined ? segment : item;
    return { state, rule: data.rule, initial, evaluation: state ? evaluateTempoProgression(data.rule,state,data.observations,dayKey(new Date(state.startedAt))) : undefined,
      evidence: state && target?.targetBpm !== undefined && target.noteVal !== undefined ? targetEvidence(state,data.observations,{ bpm: target.targetBpm, noteVal: target.noteVal }) : undefined };
  }
  private async prepare(request: TempoChangeRequest, tx: Pick<TempoProgressionTransaction,"read"|"history">): Promise<TempoProgressionPreview | null> {
    const data = await tx.read(request.owner), state = findState(data,request.context);
    if (!data.rule?.enabled) return null;
    if (!data.items.some(i => i.id === request.context.itemId) || (request.context.segmentId !== undefined && !data.segments.some(s => s.id === request.context.segmentId && s.itemId === request.context.itemId))) throw new Error("Invalid tempo context");
    const history = state ? [] : await tx.history(request.context);
    const source = initialTempo(request.context,history,data.rule.minConfidence);
    const proposed = state ? evaluateTempoProgression(data.rule,state,data.observations,dayKey(new Date(state.startedAt))).suggestion?.tempo : request.initialTempo ?? (source?.mark.bpm !== undefined && source.mark.noteVal ? { bpm: source.mark.bpm, noteVal: source.mark.noteVal } : undefined);
    if (!proposed) return null;
    bpmSchema.parse(proposed.bpm); noteValSchema.parse(proposed.noteVal);
    const reference = state ? { id: state.id, cycle: state.cycle+1, minConfidence: data.rule.minConfidence } : undefined;
    const plans = planTempoUpdates({ ...data, context: request.context, tempo: proposed, reference, fromDate: dayKey(new Date(this.clock())), sourceTaskId: state ? request.sourceTaskId : undefined });
    const fingerprint = JSON.stringify({ request, proposed, rule: data.rule, revision: data.ruleRevision, state, observations: [...data.observations].sort((a,b) => a.sessionId-b.sessionId || (a.mark.segmentId ?? 0)-(b.mark.segmentId ?? 0)), history, tasks: [...data.tasks].sort((a,b) => a.id!-b.id!), segments: data.segments, items: data.items, plans });
    return { request, current: state?.tempo, proposed, expectedCycle: state?.cycle, expectedRuleRevision: data.ruleRevision, fingerprint, ...plans };
  }
  preview(request: TempoChangeRequest) { return this.prepare(request,this.repository); }
  accept(preview: TempoProgressionPreview): Promise<TempoAcceptResult> {
    return this.repository.transaction(async tx => {
      const fresh = await this.prepare(preview.request,tx);
      if (!fresh || fresh.fingerprint !== preview.fingerprint) return { status: "stale", preview: fresh };
      const data = await tx.read(fresh.request.owner), previous = findState(data,fresh.request.context);
      const next = { ...previous, owner: fresh.request.owner, context: fresh.request.context, contextKey: tempoContextKey(fresh.request.context), tempo: fresh.proposed, cycle: (previous?.cycle ?? 0)+1, startedAt: this.clock(), ruleRevision: data.ruleRevision };
      const id = await tx.putState(next);
      const state = { ...next, id };
      const { updates } = planTempoUpdates({ ...data, context: state.context, tempo: state.tempo, reference: { id, cycle: state.cycle, minConfidence: data.rule!.minConfidence }, fromDate: dayKey(new Date(this.clock())), sourceTaskId: previous ? fresh.request.sourceTaskId : undefined });
      for (const update of updates) await tx.putPlan(update.taskId,update.plan);
      return { status: "applied", state, reference: { id,cycle: state.cycle,minConfidence: data.rule!.minConfidence } };
    });
  }
  configure(owner: TempoOwner, rule: TempoProgressionRule | undefined) { return this.repository.configure(owner,rule,this.clock()); }
}
