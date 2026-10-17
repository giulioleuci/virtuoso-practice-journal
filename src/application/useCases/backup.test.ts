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
  library: [{ id: 1, subjectId: 1, kind: "study", title: "Study", studyStatus: "in_progress", catalog: "Op. 1", notes: "Keep", inRepertoire: true, targetBpm: 88, noteVal: "quarter", createdAt: 1 }],
  segments: [{ id: 1, itemId: 1, label: "A", position: 0, layers: [], barStart: 0, barEnd: 8, createdAt: 1 }],
  collections: [{ id: 1, kind: "manual", name: "Method", edition: "2026", createdAt: 1, updatedAt: 1 }],
  collectionItems: [{ id: 1, collectionId: 1, itemId: 1, position: 0, reference: "Ex. 37", pageStart: 5, pageEnd: 6, createdAt: 1 }],
  tasks: [{ id: 1, subjectId: 1, itemId: 1, linkType: "item", title: "Practice", date: "2026-10-17", plan: [{ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] }], done: true, createdAt: 1 }],
  sessions: [{ id: 1, taskId: 1, subjectId: 1, itemId: 1, linkType: "item", date: "2026-10-17", marks: [{ segmentId: 1, bpm: 56, noteVal: "eighth", targetBpm: 88, targetNoteVal: "quarter", confidence: 4, layers: [], techniques: [] }], snapshot: { taskTitle: "Practice", subjectName: "Piano", segments: [{ id: "1", label: "Old A", barStart: 0, barEnd: 4 }] }, createdAt: 1 }],
  performances: [{ id: 1, name: "Recital", kind: "concert", date: "2026-10-18", createdAt: 1 }],
  performanceItems: [{ id: 1, eventId: 1, itemId: 1, createdAt: 1 }],
});

describe("backup use cases", () => {
  it("exports v4 using one timestamp for content and filename", async () => {
    const files = new FakeFiles();
    let calls = 0;
    await new ExportBackupUseCase(new FakeBackupRepository(valid()), files, () => ++calls === 1 ? 123 : 86_400_000).execute();
    expect(files.saved?.filename).toBe("virtuoso-backup-1970-01-01.json");
    expect(JSON.parse(files.saved!.content)).toEqual({ version: 4, exportedAt: 123, data: valid() });
  });
  it("round trips every new field including distinct historical figures and bars", async () => {
    const data = valid();
    const repository = new FakeBackupRepository(data);
    const content = await new ExportBackupUseCase(repository, new FakeFiles()).createContent();
    await new ImportBackupUseCase(repository, new FakeFiles(content)).execute();
    expect(repository.imported).toEqual(data);
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
