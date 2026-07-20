export type BackupData = Record<string, unknown[]>;

export interface BackupPort {
  exportAll(): Promise<string>;
  importAll(json: string): Promise<void>;
  wipeAll(): Promise<void>;
}
