import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import { BrowserBackupFileGateway } from "./BrowserBackupFileGateway";

export class CapacitorBackupFileGateway implements BackupFileGateway {
  constructor(private readonly browser: BackupFileGateway = new BrowserBackupFileGateway()) {}

  async save(filename: string, content: string): Promise<void> {
    try {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      try {
        const { Share } = await import("@capacitor/share");
        const uri = await Filesystem.getUri({ path: filename, directory: Directory.Documents });
        await Share.share({ title: filename, url: uri.uri, dialogTitle: "Save backup" });
      } catch { /* Backup remains saved even if sharing is unavailable. */ }
    } catch {
      await this.browser.save(filename, content);
    }
  }

  pick(): Promise<string | null> { return this.browser.pick(); }
}
