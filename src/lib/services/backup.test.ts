import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { backupService } from "./backup";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("backupService export / import", () => {
  it("round-trips every table", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 2 });

    const json = await backupService.exportAll();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.data.subjects).toHaveLength(1);
    expect(parsed.data.library).toHaveLength(1);

    await backupService.wipeAll();
    expect(await db.subjects.count()).toBe(0);

    await backupService.importAll(json);
    const subjects = await db.subjects.toArray();
    const items = await db.library.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("Piano");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Sonata");
  });

  it("rejects payloads with the wrong shape", async () => {
    await expect(backupService.importAll("not json")).rejects.toThrow();
    await expect(backupService.importAll(JSON.stringify({ data: { subjects: "no" } }))).rejects.toThrow();
  });

  it("replaces existing data entirely on import", async () => {
    await db.subjects.add({ name: "Old", type: "instrument", createdAt: 1 });
    const json = JSON.stringify({
      version: 1,
      data: { subjects: [{ name: "New", type: "theory", createdAt: 9 }] },
    });
    await backupService.importAll(json);
    const subjects = await db.subjects.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("New");
  });
});
