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

describe("backup use cases", () => {
  it("exports current data in version 2 backup format", async () => {
    const files = new FakeFiles();
    let calls = 0;
    await new ExportBackupUseCase(new FakeBackupRepository({ tasks: [{ id: 1 }] }), files, () => {
      calls += 1;
      return calls === 1 ? 123 : 86_400_000;
    }).execute();
    expect(files.saved).toEqual({
      filename: "virtuoso-backup-1970-01-01.json",
      content: JSON.stringify({ version: 2, exportedAt: 123, data: { tasks: [{ id: 1 }] } }, null, 2),
    });
  });

  it("imports supported backup data selected by gateway", async () => {
    const repository = new FakeBackupRepository();
    const files = new FakeFiles(JSON.stringify({ version: 2, data: { tasks: [{ id: 1 }] } }));
    await expect(new ImportBackupUseCase(repository, files).execute()).resolves.toBe(true);
    expect(repository.imported).toEqual({ tasks: [{ id: 1 }] });
  });

  it("rejects malformed backup input before replacing data", async () => {
    const repository = new FakeBackupRepository();
    await expect(new ImportBackupUseCase(repository, new FakeFiles("not json")).execute()).rejects.toThrow();
    expect(repository.imported).toBeUndefined();
  });

  it("rejects unsupported backup versions before replacing data", async () => {
    const repository = new FakeBackupRepository();
    const files = new FakeFiles(JSON.stringify({ version: 3, data: {} }));
    await expect(new ImportBackupUseCase(repository, files).execute()).rejects.toThrow("Unsupported backup version: 3");
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
});
