export interface BackupFileGateway {
  save(filename: string, content: string): Promise<void>;
  pick(): Promise<string | null>;
}
