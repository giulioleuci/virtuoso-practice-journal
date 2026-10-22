import { describe, expect, it } from "vitest";
import { ExportBackupUseCase } from "./exportBackup";
import { ImportBackupUseCase } from "./importBackup";
import type { BackupData, BackupPort } from "@/domain/ports/backup";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";

class FakeBackupRepository implements BackupPort {
  imported?: BackupData;
  constructor(private readonly data: BackupData = {}) {}
  async exportAll() { return this.data; }
  async importAll(data: BackupData) { this.imported = data; }
  async wipeAll() {}
}
class FakeFiles implements BackupFileGateway {
  saved?: { filename: string; content: string };
  constructor(private readonly picked: string | null = null) {}
  async save(filename: string, content: string) { this.saved = { filename, content }; }
  async pick() { return this.picked; }
}
const valid = (): BackupData => ({
  subjects: [{ id: 1, name: "Piano", type: "instrument", createdAt: 1 }],
  library: [{ id: 1, subjectId: 1, kind: "study", title: "Study", catalog: "Op. 1", notes: "Keep", inRepertoire: true, isFavorite: true, targetBpm: 88, noteVal: "quarter", createdAt: 1 }],
  segments: [{ id: 1, itemId: 1, label: "A", position: 0, layers: [], barStart: 0, barEnd: 8, createdAt: 1 }],
  collections: [{ id: 1, kind: "manual", name: "Method", edition: "2026", createdAt: 1, updatedAt: 1 }],
  collectionItems: [{ id: 1, collectionId: 1, itemId: 1, position: 0, reference: "Ex. 37", pageStart: 5, pageEnd: 6, createdAt: 1 }],
  tasks: [{ id: 1, subjectId: 1, itemId: 1, linkType: "item", title: "Practice", date: "2026-10-17", plan: [{ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] }], done: true, createdAt: 1 }],
  sessions: [{ id: 1, taskId: 1, subjectId: 1, itemId: 1, linkType: "item", date: "2026-10-17", marks: [{ segmentId: 1, bpm: 56, noteVal: "eighth", targetBpm: 88, targetNoteVal: "quarter", confidence: 4, layers: [], techniques: [] }], snapshot: { taskTitle: "Practice", subjectName: "Piano", segments: [{ id: "1", label: "Old A", barStart: 0, barEnd: 4 }] }, createdAt: 1 }],
  performances: [{ id: 1, name: "Recital", kind: "concert", date: "2026-10-18", createdAt: 1 }],
  performanceItems: [{ id: 1, eventId: 1, itemId: 1, createdAt: 1 }],
});

describe("backup use cases", () => {
  it("exports v6 using one timestamp for content and filename", async () => {
    const files = new FakeFiles();
    let calls = 0;
    await new ExportBackupUseCase(new FakeBackupRepository(valid()), files, () => ++calls === 1 ? 123 : 86_400_000).execute();
    expect(files.saved?.filename).toBe("virtuoso-backup-1970-01-01.json");
    expect(JSON.parse(files.saved!.content)).toEqual({ version: 6, exportedAt: 123, data: valid() });
  });
  it("round trips every new field including distinct historical figures and bars", async () => {
    const data = valid();
    const repository = new FakeBackupRepository(data);
    const content = await new ExportBackupUseCase(repository, new FakeFiles()).createContent();
    await new ImportBackupUseCase(repository, new FakeFiles(content)).execute();
    expect(repository.imported).toEqual({ ...data, sessions: data.sessions.map(session => ({ ...session as object, tempoProgressionIds: [], tempoSegmentIds: [1] })) });
  });
  it("drops obsolete study status from older v4 backups and keeps the remaining fields", async () => {
    const data = valid();
    const repository = new FakeBackupRepository();
    const legacy = { ...data, library: data.library.map(item => ({ ...item as object, studyStatus: "consolidated" })) };
    await new ImportBackupUseCase(repository, new FakeFiles()).importContent(JSON.stringify({ version: 4, data: legacy }));
    expect(repository.imported).toEqual({ ...data,sessions: data.sessions.map(session => ({...session as object,tempoProgressionIds:[],tempoSegmentIds:[1]})) });
  });
  it.each([undefined, 1, 2, 3, 99])("rejects incompatible version %s without mutations", async version => {
    const repository = new FakeBackupRepository();
    await expect(new ImportBackupUseCase(repository, new FakeFiles()).importContent(JSON.stringify({ version, data: {} }))).rejects.toThrow();
    expect(repository.imported).toBeUndefined();
  });
  it.each([
    ["dangling subject", (d: BackupData) => { d.subjects = []; }],
    ["dangling item", (d: BackupData) => { d.library = []; }],
    ["duplicate ID", (d: BackupData) => { d.library.push(d.library[0]); }],
    ["duplicate membership", (d: BackupData) => { d.collectionItems.push({ ...d.collectionItems[0] as object, id: 2 }); }],
    ["invalid bar range", (d: BackupData) => { d.segments[0] = { ...d.segments[0] as object, barEnd: -1 }; }],
    ["incomplete target", (d: BackupData) => { d.library[0] = { ...d.library[0] as object, noteVal: undefined }; }],
    ["invalid favorite", (d: BackupData) => { d.library[0] = { ...d.library[0] as object, isFavorite: "yes" }; }],
    ["non-performable repertoire", (d: BackupData) => { d.library[0] = { ...d.library[0] as object, kind: "exercise" }; d.performanceItems = []; }],
    ["non-performable programme", (d: BackupData) => { d.library[0] = { ...d.library[0] as object, kind: "exercise", inRepertoire: false }; }],
    ["foreign section in plan", (d: BackupData) => { d.segments[0] = { ...d.segments[0] as object, itemId: 2 }; d.library.push({ ...d.library[0] as object, id: 2 }); }],
    ["foreign section in result", (d: BackupData) => { d.tasks = []; d.library.push({ ...d.library[0] as object, id: 2 }); d.sessions[0] = { ...d.sessions[0] as object, taskId: undefined, itemId: 2 }; }],
    ["invalid rating", (d: BackupData) => { d.sessions[0] = { ...d.sessions[0] as object, marks: [{ confidence: 6, layers: [], techniques: [] }] }; }],
  ])("rejects %s before replacing data", async (_name, mutate) => {
    const repository = new FakeBackupRepository();
    const data = valid(); mutate(data);
    await expect(new ImportBackupUseCase(repository, new FakeFiles()).importContent(JSON.stringify({ version: 4, data }))).rejects.toThrow();
    expect(repository.imported).toBeUndefined();
  });
  it("preserves the repository's atomic import error", async () => {
    const repository: BackupPort = { exportAll: async () => ({}), importAll: async () => { throw new Error("transaction rolled back"); }, wipeAll: async () => {} };
    await expect(new ImportBackupUseCase(repository, new FakeFiles()).importContent(JSON.stringify({ version: 4, data: valid() }))).rejects.toThrow("transaction rolled back");
  });
  it("rejects malformed input and allows cancelling selection", async () => {
    const repository = new FakeBackupRepository();
    await expect(new ImportBackupUseCase(repository, new FakeFiles("not json")).execute()).rejects.toThrow();
    expect(await new ImportBackupUseCase(repository, new FakeFiles()).execute()).toBeNull();
    expect(repository.imported).toBeUndefined();
  });
});

it("round trips v6 cycles, validates ownership and rebuilds session indexes", async () => {
  const data = valid();
  const rule = { enabled: true, successes: 3, minConfidence: 4, increase: { kind: "percent", value: 3 } };
  const context = { itemId: 1, segmentId: 1, layers: [], techniques: [] };
  data.studyRoutines = [{ id: 1, subjectId: 1, groups: [], tempoRule: rule, tempoRuleRevision: 2, createdAt: 1 }];
  data.tasks[0] = { ...data.tasks[0] as object, studyRoutineId: 1 };
  data.tempoProgressions = [{ id: 1, owner: { kind: "routine", id: 1 }, context, contextKey: JSON.stringify([1,1,[],[]]), tempo: { bpm: 1, noteVal: "quarter" }, cycle: 2, startedAt: 1, ruleRevision: 2 }];
  data.sessions[0] = { ...data.sessions[0] as object, tempoProgressionIds: [999], marks: [{ segmentId: 1, bpm: 10, noteVal: "dotted-quarter", confidence: 4, layers: [], techniques: [], progression: { id: 1, cycle: 1, minConfidence: 4 } }] };
  const repository = new FakeBackupRepository(data);
  const exported = await new ExportBackupUseCase(repository,new FakeFiles()).createContent();
  expect(JSON.parse(exported).version).toBe(6);
  await new ImportBackupUseCase(repository,new FakeFiles()).importContent(exported);
  expect(repository.imported?.tempoProgressions).toEqual(data.tempoProgressions);
  expect((repository.imported?.sessions[0] as { tempoProgressionIds: number[] }).tempoProgressionIds).toEqual([1]);
  for (const mutate of [
    (d: BackupData) => { d.studyRoutines = []; },
    (d: BackupData) => { d.tempoProgressions[0] = { ...d.tempoProgressions[0] as object, contextKey: "wrong" }; },
    (d: BackupData) => { d.tempoProgressions[0] = { ...d.tempoProgressions[0] as object, cycle: 0 }; },
    (d: BackupData) => { d.tempoProgressions.push({ ...d.tempoProgressions[0] as object, id: 2 }); },
  ]) {
    const invalid = JSON.parse(exported); mutate(invalid.data);
    const target = new FakeBackupRepository();
    await expect(new ImportBackupUseCase(target,new FakeFiles()).importContent(JSON.stringify(invalid))).rejects.toThrow();
    expect(target.imported).toBeUndefined();
  }
});

it.each([4,5])("rebuilds history indexes for legacy v%s combined sessions",async version=>{
  const data=valid();data.tasks[0]={...data.tasks[0] as object,itemId:undefined,linkType:"free"};
  data.sessions[0]={...data.sessions[0] as object,itemId:undefined,linkType:"free",snapshot:undefined};
  const repository=new FakeBackupRepository();
  await new ImportBackupUseCase(repository,new FakeFiles()).importContent(JSON.stringify({version,data}));
  expect(repository.imported?.sessions[0]).toMatchObject({tempoProgressionIds:[],tempoSegmentIds:[1]});
});
it("rejects a task plan linked to another owner's progression before changing data",async()=>{
  const data=valid(),rule={enabled:true,successes:3,minConfidence:4,increase:{kind:"percent",value:3}};
  data.studyRoutines=[1,2].map(id=>({id,subjectId:1,groups:[],createdAt:1,tempoRule:rule,tempoRuleRevision:1}));
  data.tempoProgressions=[{id:1,owner:{kind:"routine",id:1},context:{itemId:1,segmentId:1,layers:[],techniques:[]},contextKey:JSON.stringify([1,1,[],[]]),tempo:{bpm:70,noteVal:"quarter"},cycle:1,startedAt:1,ruleRevision:1}];
  data.tasks[0]={...data.tasks[0] as object,studyRoutineId:2,plan:[{segmentId:1,bpm:70,noteVal:"quarter",layers:[],techniques:[],progression:{id:1,cycle:1,minConfidence:4}}]};
  const repository=new FakeBackupRepository();
  await expect(new ImportBackupUseCase(repository,new FakeFiles()).importContent(JSON.stringify({version:6,data}))).rejects.toThrow();
  expect(repository.imported).toBeUndefined();
});
