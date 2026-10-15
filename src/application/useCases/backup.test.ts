import { describe, expect, it } from "vitest";
import { ExportBackupUseCase } from "./exportBackup";
import { ImportBackupUseCase } from "./importBackup";
import type { Session } from "@/domain/entities/session";
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

describe("backup use cases", () => {
  it("exports current data in version 3 backup format", async () => {
    const files = new FakeFiles();
    let calls = 0;
    await new ExportBackupUseCase(new FakeBackupRepository({ tasks: [{ id: 1 }] }), files, () => {
      calls += 1;
      return calls === 1 ? 123 : 86_400_000;
    }).execute();
    expect(files.saved).toEqual({
      filename: "virtuoso-backup-1970-01-01.json",
      content: JSON.stringify({ version: 3, exportedAt: 123, data: { tasks: [{ id: 1 }] } }, null, 2),
    });
  });

  it("imports supported backup data selected by gateway", async () => {
    const repository = new FakeBackupRepository();
    const files = new FakeFiles(JSON.stringify({ version: 2, data: { tasks: [{ id: 1 }] } }));
    await expect(new ImportBackupUseCase(repository, files).execute()).resolves.toEqual({ recordings: 0, available: 0 });
    expect(repository.imported).toEqual({ tasks: [{ id: 1 }] });
  });

  it("rejects malformed backup input before replacing data", async () => {
    const repository = new FakeBackupRepository();
    await expect(new ImportBackupUseCase(repository, new FakeFiles("not json")).execute()).rejects.toThrow();
    expect(repository.imported).toBeUndefined();
  });

  it("rejects unsupported backup versions before replacing data", async () => {
    const repository = new FakeBackupRepository();
    const files = new FakeFiles(JSON.stringify({ version: 99, data: {} }));
    await expect(new ImportBackupUseCase(repository, files).execute()).rejects.toThrow("Unsupported backup version: 99");
    expect(repository.imported).toBeUndefined();
  });

  it("does not commit data when repository transaction rolls back", async () => {
    const files = new FakeFiles(JSON.stringify({ version: 2, data: { tasks: [{ id: 1 }] } }));
    const repository: BackupPort = {
      exportAll: async () => ({}),
      importAll: async () => { throw new Error("transaction rolled back"); },
      wipeAll: async () => {},
    };
    await expect(new ImportBackupUseCase(repository, files).execute()).rejects.toThrow("transaction rolled back");
  });

  it("rejects unknown versions and out-of-scale ratings before touching data", async () => {
    const repository = new FakeBackupRepository();
    const useCase = new ImportBackupUseCase(repository, new FakeFiles());
    await expect(useCase.importContent(JSON.stringify({ version: 99, data: {} }))).rejects.toThrow("Unsupported backup version: 99");
    await expect(useCase.importContent(JSON.stringify({ version: 3, data: { sessions: [{ id: 1, date: "2026-10-01", marks: [{ layers: [], techniques: [], mood: 6 }], createdAt: 1 }] } }))).rejects.toThrow();
    expect(repository.imported).toBeUndefined();
  });

  it("back-fills session references in older backups and leaves missing ratings missing", async () => {
    const repository = new FakeBackupRepository();
    await new ImportBackupUseCase(repository, new FakeFiles()).importContent(JSON.stringify({ version: 2, data: {
      tasks: [{ id: 4, subjectId: 2, linkType: "item", itemId: 5, title: "Etude", date: "2026-10-01", plan: [], done: true, createdAt: 1 }],
      sessions: [{ id: 1, taskId: 4, date: "2026-10-01", marks: [{ layers: [], techniques: [], confidence: 3 }], notes: "keep", createdAt: 1 }],
    } }));
    const [imported] = repository.imported?.sessions as Session[];
    expect(imported).toMatchObject({ subjectId: 2, itemId: 5, notes: "keep", marks: [{ confidence: 3 }] });
    expect(imported.marks[0].mood).toBeUndefined();
  });
});
