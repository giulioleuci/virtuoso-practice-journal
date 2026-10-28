import { db } from "@/infrastructure/dexie/db";
import { pruneSchedule } from "@/infrastructure/dexie/schedulePrune";
import { today } from "@/lib/date";
import type { BackupData, BackupPort } from "@/domain/ports/backup";

export const backupRepository = {
  async exportAll() {
    const data: BackupData = {};
    for (const table of db.tables) data[table.name] = await table.toArray();
    return data;
  },
  async importAll(data: BackupData) {
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
        const rows = data[table.name];
        if (rows?.length) await table.bulkAdd(rows);
      }
      await pruneSchedule(db, today());
    });
  },
  async wipeAll() {
    await db.transaction("rw", db.tables, async () => { for (const table of db.tables) await table.clear(); });
  },
} satisfies BackupPort;
