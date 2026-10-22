import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { tempoProgressionRepository as repository } from "./tempoProgressionRepository";
import { TempoProgressionUseCase } from "@/application/useCases/tempoProgression";
import { tempoContextKey } from "@/domain/logic/tempoProgression";
import { sessionRepository } from "./sessionRepository";

const owner = { kind: "routine" as const, id: 1 };
const context = { itemId: 1, layers: [], techniques: [] };
const rule = { enabled: true, successes: 3, window: 5, minConfidence: 4, increase: { kind: "fixed" as const, value: 2, noteVal: "quarter" as const } };
const at = new Date(2026, 9, 22, 12).getTime();
const useCase = new TempoProgressionUseCase(repository, () => at);
beforeEach(async () => {
  await db.delete(); await db.open();
  await db.subjects.add({ id: 1, name: "Piano", type: "instrument", createdAt: 1 });
  await db.library.add({ id: 1, subjectId: 1, kind: "piece", title: "Piece", createdAt: 1 });
  await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, weeksAhead: 1, repetitionCap: 1, startDate: "2026-10-22", createdAt: 1 });
  for (const id of [1,2,3]) await db.tasks.add({ id, itemId: 1, studyRoutineId: 1, date: "2026-10-23", title: "Piece", subjectId: 1, plan: [{ bpm: 70, noteVal: "quarter", layers: [], techniques: [] }], done: false, createdAt: 1 });
  await repository.configure(owner, rule, at);
});
it("initializes only on confirmation, persists unique state and updates compatible plans", async () => {
  expect((await repository.read(owner)).states).toEqual([]);
  const preview = (await useCase.preview({ owner, context, initialTempo: { bpm: 70, noteVal: "quarter" } }))!;
  expect(preview.updates).toHaveLength(3);
  expect((await useCase.accept(preview)).status).toBe("applied");
  expect((await useCase.accept(preview)).status).toBe("stale");
  db.close(); await db.open();
  const state = (await repository.read(owner)).states[0];
  expect(state.contextKey).toBe(tempoContextKey(context));
  expect((await db.tasks.get(2))?.plan[0].progression).toEqual({ id: state.id, cycle: 1, minConfidence: 4 });
  await expect(db.tempoProgressions.add({ ...state, id: state.id+1 })).rejects.toThrow();
});
it("rejects stale previews after plan customization and serializes concurrent acceptance", async () => {
  const preview = (await useCase.preview({ owner, context, initialTempo: { bpm: 70, noteVal: "quarter" } }))!;
  await db.tasks.update(2, { customized: true });
  expect((await useCase.accept(preview)).status).toBe("stale");
  expect(await db.tempoProgressions.count()).toBe(0);
  const fresh = (await useCase.preview(preview.request))!;
  const results = await Promise.all([useCase.accept(fresh), useCase.accept(fresh)]);
  expect(results.map(r => r.status).sort()).toEqual(["applied", "stale"]);
  expect((await db.tasks.get(2))?.plan[0].progression).toBeUndefined();
});
it("retains historical references, resets only changed rules and excludes incomplete studied entries", async () => {
  const preview = (await useCase.preview({ owner, context, initialTempo: { bpm: 70, noteVal: "quarter" } }))!;
  await useCase.accept(preview);
  const plan = (await db.tasks.get(1))!.plan;
  await sessionRepository.transaction(async tx => tx.createSession({ taskId: 1, itemId: 1, subjectId: 1, date: "2026-10-22", createdAt: at, marks: [{ ...plan[0], confidence: 4, targetBpm: 70, targetNoteVal: "quarter" }] }));
  await repository.configure(owner, rule, at+1);
  expect((await repository.read(owner)).states[0].cycle).toBe(1);
  await repository.configure(owner, { ...rule, minConfidence: 5 }, at+2);
  expect((await repository.read(owner)).states[0].cycle).toBe(2);
  const session = (await db.sessions.toArray())[0];
  expect(session.marks[0].progression?.cycle).toBe(1);
  expect(session.tempoProgressionIds).toEqual([1]);
  expect((await db.tasks.get(1))!.plan[0].progression?.cycle).toBe(1);
  expect((await db.tasks.get(2))!.plan[0].progression?.cycle).toBe(2);
});
it("rolls back state and plans on transaction failure", async () => {
  await expect(repository.transaction(async tx => {
    await tx.putState({ owner, context, contextKey: tempoContextKey(context), tempo: { bpm: 70, noteVal: "quarter" }, cycle: 1, startedAt: at, ruleRevision: 1 });
    await tx.putPlan(1, []);
    throw new Error("disk full");
  })).rejects.toThrow("disk full");
  expect(await db.tempoProgressions.count()).toBe(0);
  expect((await db.tasks.get(1))!.plan).toHaveLength(1);
});

it("retains root ownership after removing an occurrence and rejects nonexistent progression references", async () => {
  const { taskRepository } = await import("./taskRepository");
  const root = await taskRepository.create({ subjectId: 1,itemId: 1,title: "Series",date: "2026-10-22",plan: [],recurrence: { kind: "interval",startDate: "2026-10-22",everyXDays: 1,occurrences: 2 },tempoRule: rule });
  expect(await taskRepository.remove(root)).toBe("soft");
  expect((await repository.read({ kind: "recurrence",id: root })).rule).toEqual(rule);
  await expect(sessionRepository.transaction(tx => tx.createSession({ taskId: 1,itemId: 1,date: "2026-10-22",marks: [{ layers: [],techniques: [],progression: { id: 999,cycle: 1,minConfidence: 4 } }],createdAt: 1 }))).rejects.toThrow("Invalid tempo progression reference");
});

it("resolves materials independently in combined tasks and keeps results after task removal",async()=>{
  await db.library.add({id:2,subjectId:1,kind:"piece",title:"Second",createdAt:1});
  await db.segments.bulkAdd([{id:1,itemId:1,label:"A",position:0,layers:[],createdAt:1},{id:2,itemId:2,label:"B",position:0,layers:[],createdAt:1}]);
  await db.tasks.update(1,{itemId:undefined,linkType:"free",plan:[{segmentId:1,layers:[],techniques:[]},{segmentId:2,layers:[],techniques:[]}]});
  for(const id of [1,2]){
    const preview=(await useCase.preview({owner,context:{itemId:id,segmentId:id,layers:[],techniques:[]},initialTempo:{bpm:70+id,noteVal:"quarter"}}))!;
    await useCase.accept(preview);
  }
  const task=(await db.tasks.get(1))!;
  await sessionRepository.transaction(tx=>tx.createSession({taskId:1,subjectId:1,linkType:"free",date:"2026-10-22",createdAt:at,marks:task.plan.map(entry=>({...entry,targetBpm:entry.bpm,targetNoteVal:entry.noteVal,confidence:4}))}));
  expect((await db.sessions.toArray())[0].tempoProgressionIds).toEqual([1,2]);
  await db.tasks.delete(1);
  const data=await repository.read(owner);
  expect(data.observations.map(o=>[o.context.itemId,o.mark.progression?.id])).toEqual([[1,1],[2,2]]);
  expect(await repository.history({itemId:2,segmentId:2,layers:[],techniques:[]})).toHaveLength(1);
});
it("suspends and reactivates with a new cycle, and rolls back rule changes on a final plan write error",async()=>{
  await useCase.accept((await useCase.preview({owner,context,initialTempo:{bpm:70,noteVal:"quarter"}}))!);
  await repository.configure(owner,{...rule,enabled:false},at+1);
  expect((await useCase.view(owner,context)).evaluation).toBeUndefined();
  await repository.configure(owner,rule,at+2);
  expect((await repository.read(owner)).states[0]).toMatchObject({cycle:3,tempo:{bpm:70,noteVal:"quarter"}});
  const before=await repository.read(owner);
  const original=db.tasks.update.bind(db.tasks);
  const {vi}=await import("vitest");
  const {default:Dexie}=await import("dexie");
  const fail=vi.spyOn(db.tasks,"update").mockImplementation((...args:Parameters<typeof original>)=>args[0]===3 ? Dexie.Promise.reject(Error("disk full")) : original(...args));
  try { await expect(repository.configure(owner,{...rule,minConfidence:5},at+3)).rejects.toThrow("disk full"); }
  finally { fail.mockRestore(); }
  expect(await repository.read(owner)).toEqual(before);
});

it("updates every context reference when one combined task receives a rule change",async()=>{
  await db.segments.bulkAdd([{id:1,itemId:1,label:"A",position:0,layers:[],createdAt:1},{id:2,itemId:1,label:"B",position:1,layers:[],createdAt:1}]);
  await db.tasks.update(1,{plan:[{segmentId:1,layers:[],techniques:[]},{segmentId:2,layers:[],techniques:[]}]});
  for(const segmentId of [1,2])await useCase.accept((await useCase.preview({owner,context:{...context,segmentId},initialTempo:{bpm:70,noteVal:"quarter"}}))!);
  await repository.configure(owner,{...rule,minConfidence:5},at+1);
  expect((await db.tasks.get(1))?.plan.map(e=>e.progression)).toEqual([{id:1,cycle:2,minConfidence:5},{id:2,cycle:2,minConfidence:5}]);
});

it("regenerates with the current rule even when the caller holds an older routine",async()=>{
  const {studyRoutineRepository}=await import("./studyRoutineRepository");
  await db.studyRoutines.update(1,{groups:[{id:"g",name:"Daily",pool:[{type:"item",id:1}]}],matrix:{"4":{g:1}}});
  await useCase.accept((await useCase.preview({owner,context,initialTempo:{bpm:70,noteVal:"quarter"}}))!);
  const old=(await db.studyRoutines.get(1))!;
  await repository.configure(owner,{...rule,minConfidence:5},at+1);
  await studyRoutineRepository.regenerateFromDate(old,"2026-10-22");
  const task=await db.tasks.where("date").equals("2026-10-22").first();
  expect(task?.plan[0].progression).toMatchObject({cycle:2,minConfidence:5});
});

it("serializes a rule change against carryover so the copied occurrence receives the new reference",async()=>{
  const {default:Dexie}=await import("dexie");const {taskRepository}=await import("./taskRepository");const {vi}=await import("vitest");
  await useCase.accept((await useCase.preview({owner,context,initialTempo:{bpm:70,noteVal:"quarter"}}))!);
  const source=(await db.tasks.get(2))!;
  let release=()=>{},reached=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;}),reading=new Promise<void>(resolve=>{reached=resolve;});
  const original=repository.read.bind(repository);
  const pause=vi.spyOn(repository,"read").mockImplementation(async owner=>{const data=await original(owner);reached();await Dexie.waitFor(gate);return data;});
  const carrying=taskRepository.carryOver(source,"2026-10-25").catch(error=>{throw new Error("carry: "+error.message);});await reading;
  let configured=false;
  // A separate root transaction models a second tab without sharing native async tracking with the held transaction.
  const configuring=db.transaction("rw!",[db.tasks,db.studyRoutines,db.tempoProgressions],()=>
    db.studyRoutines.update(1,{tempoRule:{...rule,minConfidence:5},tempoRuleRevision:2})
      .then(()=>db.tempoProgressions.update(1,{cycle:2,ruleRevision:2}))
      .then(()=>db.tasks.toCollection().modify(task=>{task.plan=task.plan.map(entry=>entry.progression ? {...entry,progression:{...entry.progression,cycle:2,minConfidence:5}} : entry);}))
      .then(()=>{configured=true;}));
  await new Promise(resolve=>setTimeout(resolve,40));
  expect(configured).toBe(false);release();
  try {
    const id=await carrying;await configuring;
    expect((await db.tasks.get(id))?.plan[0].progression).toMatchObject({cycle:2,minConfidence:5});
  } finally { release();pause.mockRestore(); }
});
