import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { audioDb } from "@/infrastructure/dexie/audioDb";
import { browserAudio } from "./browserAudio";
import { backupRepository } from "@/infrastructure/repositories/dexie/backupRepository";
import { sessionRepository } from "@/infrastructure/repositories/dexie/sessionRepository";
import { taskRepository } from "@/infrastructure/repositories/dexie/taskRepository";
import { LogSessionUseCase } from "@/application/useCases/logSession";
import { ImportBackupUseCase } from "@/application/useCases/importBackup";

const LOCAL = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const rated = { layers: [], techniques: [], mood: 3, focus: 3, confidence: 3 };
const files = { save: async () => undefined, pick: async () => null };

beforeEach(async () => {
  await db.delete(); await db.open();
  await audioDb.clips.clear();
});

it("saves clip metadata with the session and leaves none behind when the save fails", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const task = (await db.tasks.get(await taskRepository.create({ title: "Scales", date: "2026-10-01", subjectId, plan: [] })))!;
  const clips = [{ uid: LOCAL, mimeType: "audio/webm", durationMs: 1000 }];
  const original = db.helpRequests.add;
  db.helpRequests.add = (() => Promise.reject(new Error("help fails"))) as unknown as typeof db.helpRequests.add;
  await expect(new LogSessionUseCase(sessionRepository).execute(task, { date: "2026-10-01", marks: [rated], helpText: "?", clips })).rejects.toThrow("help fails");
  db.helpRequests.add = original;
  expect(await db.recordings.count()).toBe(0);

  const id = await new LogSessionUseCase(sessionRepository).execute(task, { date: "2026-10-01", marks: [rated], clips });
  expect(await db.recordings.where("sessionId").equals(id).toArray()).toMatchObject([{ uid: LOCAL, sessionId: id, date: "2026-10-01" }]);
});

it("deleting a session removes its clip metadata and local audio together", async () => {
  await audioDb.clips.put({ uid: LOCAL, data: new Uint8Array([1]).buffer, mimeType: "audio/webm" });
  await db.sessions.add({ id: 5, date: "2026-10-01", marks: [], createdAt: 1 });
  await db.recordings.add({ uid: LOCAL, sessionId: 5, date: "2026-10-01", mimeType: "audio/webm", durationMs: 900, createdAt: 1 });
  await sessionRepository.deleteWithTaskReset(5);
  expect(await db.recordings.count()).toBe(0);
  expect(await audioDb.clips.get(LOCAL)).toBeUndefined();
});

it("exports clip metadata but no audio, and import keeps local audio, matched by uid only", async () => {
  await audioDb.clips.put({ uid: LOCAL, data: new Uint8Array([1, 2]).buffer, mimeType: "audio/webm" });
  await db.sessions.add({ id: 1, date: "2026-10-01", marks: [], createdAt: 1 });
  await db.recordings.add({ id: 1, uid: LOCAL, sessionId: 1, date: "2026-10-01", mimeType: "audio/webm", durationMs: 900, createdAt: 1 });

  const exported = JSON.stringify(await backupRepository.exportAll());
  expect(exported).toContain(LOCAL);
  expect(exported).not.toMatch(/"data"|base64|blob:|file:\/\//);

  // A backup from another device reuses session id 1 and recording id 1 for a different clip.
  const summary = await new ImportBackupUseCase(backupRepository, files, browserAudio).importContent(JSON.stringify({ version: 3, data: {
    sessions: [{ id: 1, date: "2026-10-02", marks: [], createdAt: 2 }],
    recordings: [{ id: 1, uid: OTHER, sessionId: 1, date: "2026-10-02", mimeType: "audio/webm", durationMs: 500, createdAt: 2 }],
  } }));

  expect(summary).toEqual({ recordings: 1, available: 0 });
  expect(await audioDb.clips.get(LOCAL)).toBeDefined();
  expect(await browserAudio.url(OTHER)).toBeNull();
});

it("rejects recordings that carry audio payloads or point at missing sessions, without touching data", async () => {
  await db.subjects.add({ name: "Kept", type: "instrument", createdAt: 1 });
  const useCase = new ImportBackupUseCase(backupRepository, files, browserAudio);
  const base = { uid: OTHER, sessionId: 1, date: "2026-10-02", mimeType: "audio/webm", durationMs: 500, createdAt: 2 };
  await expect(useCase.importContent(JSON.stringify({ version: 3, data: { sessions: [{ id: 1, date: "2026-10-02", marks: [], createdAt: 2 }], recordings: [{ ...base, data: "AAAA" }] } }))).rejects.toThrow();
  await expect(useCase.importContent(JSON.stringify({ version: 3, data: { recordings: [base] } }))).rejects.toThrow(/missing session/);
  expect(await db.subjects.count()).toBe(1);
});
