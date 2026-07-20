export type BackupData = Record<string, unknown[]>;

export interface BackupPort {
  exportAll(): Promise<BackupData>;
  importAll(data: BackupData): Promise<void>;
  wipeAll(): Promise<void>;
}
