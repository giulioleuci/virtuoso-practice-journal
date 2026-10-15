import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";

export class BrowserBackupFileGateway implements BackupFileGateway {
  async save(filename: string, content: string): Promise<void> {
    const blob = new Blob([content], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  pick(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("focus", onFocus);
        resolve(value);
      };
      const onFocus = () => setTimeout(() => { if (!input.files?.length) settle(null); }, 300);
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return settle(null);
        const reader = new FileReader();
        reader.onerror = () => settle(null);
        reader.onload = () => settle(typeof reader.result === "string" ? reader.result : null);
        reader.readAsText(file);
      };
      input.oncancel = () => settle(null);
      window.addEventListener("focus", onFocus, { once: true });
      input.click();
    });
  }
}
