import type { TempoOwnerData, TempoProgressionPort, TempoProgressionTransaction } from "@/domain/ports/tempoProgression";
import type { TempoObservation, TempoProgressionRule } from "@/domain/entities/tempoProgression";
export class FakeTempoProgressionRepository implements TempoProgressionPort {
  historyRows: TempoObservation[] = [];
  failOnPlan?: number;
  constructor(public data: TempoOwnerData) {}
  async read() { return structuredClone(this.data); }
  async history() { return structuredClone(this.historyRows); }
  async configure(_owner: unknown, rule: TempoProgressionRule | undefined) { this.data.rule=rule; this.data.ruleRevision++; }
  async transaction<T>(operation: (tx: TempoProgressionTransaction) => Promise<T>): Promise<T> {
    const before=structuredClone(this.data);
    try { return await operation({ read: () => this.read(),history: () => this.history(),putState: async state => {
      const id=state.id ?? Math.max(0,...this.data.states.map(s => s.id))+1;
      this.data.states=this.data.states.filter(s => s.id !== id).concat({ ...state,id }); return id;
    },putPlan: async (id,plan) => { if (id === this.failOnPlan) throw new Error("disk full"); const task=this.data.tasks.find(t => t.id === id); if(task) task.plan=structuredClone(plan); } }); }
    catch(error) { this.data=before; throw error; }
  }
}
