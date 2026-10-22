import { expect,it } from "vitest";
import { TempoProgressionUseCase } from "./tempoProgression";
import { FakeTempoProgressionRepository } from "@/test/fakes/FakeTempoProgressionRepository";
import { tempoContextKey } from "@/domain/logic/tempoProgression";
const context={ itemId: 1,layers: [],techniques: [] };
const owner={ kind: "routine" as const,id: 1 };
const at=new Date(2026,9,22,12).getTime();
function fixture() {
 const repository=new FakeTempoProgressionRepository({ owner,rule: { enabled: true,successes: 3,window: 4,minConfidence: 4,increase: { kind: "fixed",value: 2,noteVal: "quarter" } },ruleRevision: 1,states: [{ id: 1,owner,context,contextKey: tempoContextKey(context),tempo: { bpm: 70,noteVal: "quarter" },cycle: 1,startedAt: at,ruleRevision: 1 }],tasks: [2,3,4].map(id => ({ id,subjectId: 1,itemId: 1,studyRoutineId: 1,title: "Piece",date: "2026-10-23",plan: [{ bpm: 70,noteVal: "quarter",layers: [],techniques: [] }],done: false,customized: id===4,createdAt: 1 })),observations: [1,2,3].map(id => ({ sessionId: id,taskId: 1,date: "2026-10-22",createdAt: at+id,context,mark: { bpm: 140,noteVal: "eighth",targetBpm: 70,targetNoteVal: "quarter",confidence: 4,layers: [],techniques: [],progression: { id: 1,cycle: 1,minConfidence: 4 } } })),segments: [],items: [{ id: 1,subjectId: 1,kind: "piece",title: "Piece",createdAt: 1,targetBpm: 60,noteVal: "quarter" }] });
 return { repository,useCase: new TempoProgressionUseCase(repository,()=>at) };
}
it("previews 72 beyond final target and protects custom tasks; acceptance resets exactly once",async()=>{
 const { repository,useCase }=fixture();const preview=(await useCase.preview({ owner,context,sourceTaskId: 1 }))!;
 expect(preview.proposed.bpm).toBe(72);expect(preview.updates.map(u=>u.taskId)).toEqual([2,3]);
 expect(preview.excluded).toEqual([{ taskId: 4,reason: "customized" }]);
 expect((await useCase.accept(preview)).status).toBe("applied");
 expect(repository.data.states[0].cycle).toBe(2);expect((await useCase.accept(preview)).status).toBe("stale");
 expect(repository.data.observations[0].mark.progression?.cycle).toBe(1);
});
it("rejects each material change to the decision or preview without writing",async()=>{
 for(const change of [
  (r:FakeTempoProgressionRepository)=>{r.data.rule!.minConfidence=5;},
  (r:FakeTempoProgressionRepository)=>{r.data.observations[0].mark.confidence=3;},
  (r:FakeTempoProgressionRepository)=>{r.data.tasks[0].customized=true;},
  (r:FakeTempoProgressionRepository)=>{r.data.tasks[0].date="2026-10-24";},
 ]){ const { repository,useCase }=fixture();const preview=(await useCase.preview({ owner,context }))!;change(repository);const before=structuredClone(repository.data);expect((await useCase.accept(preview)).status).toBe("stale");expect(repository.data).toEqual(before); }
});
it("rolls back an error on the last write and supports zero-task initialization without counting historical sources",async()=>{
 const { repository,useCase }=fixture();const preview=(await useCase.preview({ owner,context }))!;const before=structuredClone(repository.data);repository.failOnPlan=3;
 await expect(useCase.accept(preview)).rejects.toThrow("disk full");expect(repository.data).toEqual(before);
 repository.failOnPlan=undefined;repository.data.states=[];repository.data.tasks=[];
 repository.historyRows=before.observations;
 const initial=(await useCase.preview({ owner,context,initialTempo: { bpm: 10,noteVal: "dotted-quarter" } }))!;
 expect(initial.updates).toEqual([]);expect((await useCase.accept(initial)).status).toBe("applied");
 expect((await useCase.view(owner,context)).evaluation?.evaluated).toBe(0);
});
