import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "./db";
import { pruneSchedule } from "./schedulePrune";
import { backupRepository } from "@/infrastructure/repositories/dexie/backupRepository";
import { PROTECTED_IDS, WINDOW_END, scheduleFixture } from "@/test/scheduleFixture";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T12:00:00"));
  await db.delete();
  await db.open();
});
afterEach(() => vi.useRealTimers());

const beyond = async () => (await db.tasks.where("date").above(WINDOW_END).primaryKeys()).sort((a, b) => a - b);

it("keeps only the window plus rows the user touched, and stamps every series", async () => {
  const f = scheduleFixture();
  await db.tasks.bulkAdd(f.tasks as never); await db.studyRoutines.bulkAdd(f.studyRoutines as never);
  await db.sessions.bulkAdd(f.sessions as never); await db.assignments.bulkAdd(f.assignments as never);
  expect(await pruneSchedule(db, "2026-10-28")).toBe(90);
  expect(await beyond()).toEqual(PROTECTED_IDS);
  expect(await db.tasks.count()).toBe(36);
  expect((await db.tasks.get(1))!.materializedUntil).toBe(WINDOW_END);
  expect((await db.studyRoutines.get(1))!.materializedUntil).toBe(WINDOW_END);
  expect(await pruneSchedule(db, "2026-10-28")).toBe(0);
});

it("prunes on backup import", async () => {
  const f = scheduleFixture();
  await backupRepository.importAll(f as never);
  expect(await beyond()).toEqual(PROTECTED_IDS);
});
