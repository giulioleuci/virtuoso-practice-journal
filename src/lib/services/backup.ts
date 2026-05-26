/** Backup service — full-database export / import / wipe. */
import { z } from "zod";
import { db } from "@/lib/db";

const importDataSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.number().optional(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
});

export const backupService = {
  async exportAll(): Promise<string> {
    const dump: Record<string, unknown> = {};
    for (const tbl of db.tables) dump[tbl.name] = await tbl.toArray();
    return JSON.stringify({ version: 1, exportedAt: Date.now(), data: dump }, null, 2);
  },

  async importAll(json: string): Promise<void> {
    const raw = JSON.parse(json);
    const parsed = importDataSchema.parse(raw);
    await db.transaction("rw", db.tables, async () => {
      for (const tbl of db.tables) {
        await tbl.clear();
        const rows = parsed.data?.[tbl.name];
        if (Array.isArray(rows) && rows.length) await tbl.bulkAdd(rows);
      }
    });
  },

  async wipeAll(): Promise<void> {
    await db.transaction("rw", db.tables, async () => {
      for (const tbl of db.tables) await tbl.clear();
    });
  },
};
