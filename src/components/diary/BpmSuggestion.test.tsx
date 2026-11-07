/* eslint-disable no-restricted-imports -- Integration test verifies the real preview and persistence boundary. */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { tempoProgressionRepository } from "@/infrastructure/repositories/dexie/tempoProgressionRepository";
import { BpmSuggestion } from "./BpmSuggestion";
import { today } from "@/lib/date";
import { applicationCommands } from "@/lib/applicationCommands";
import { sessionRepository } from "@/infrastructure/repositories/dexie/sessionRepository";
import type { Task } from "@/domain/entities/task";
afterEach(cleanup);
it("keeps subtask suggestions independent and updates only the confirmed section of future tasks", async () => {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.library.add({ id: 1, title: "Sonata", subjectId: 1, kind: "piece", createdAt: 1 });
  await db.segments.bulkAdd([1, 2].map(id => ({ id, itemId: 1, label: `Section ${id}`, position: id, layers: [], createdAt: 1 })));
  await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, startDate: today(), weeksAhead: 1, repetitionCap: 1, createdAt: 1 });
  const owner = { kind: "routine" as const, id: 1 };
  await tempoProgressionRepository.configure(owner, { enabled: true, successes: 2, minConfidence: 4, increase: { kind: "percent", value: 10 }, decrease: { failures: 2, step: { kind: "percent", value: 10 } } }, Date.now());
  const task: Task = { id: 1, title: "Daily Practice", subjectId: 1, itemId: 1, studyRoutineId: 1, date: today(), plan: [1, 2].map(segmentId => ({ segmentId, layers: [], techniques: [] })), done: false, createdAt: 1 };
  await db.tasks.bulkAdd([task, { ...task, id: 2 }]);
  for (const segmentId of [1, 2]) {
    const preview = (await applicationCommands.tempoProgression.preview({ owner, context: { itemId: 1, segmentId, layers: [], techniques: [] }, initialTempo: { bpm: segmentId === 1 ? 70 : 100, noteVal: "quarter" } }))!;
    await applicationCommands.tempoProgression.accept(preview);
  }
  const sourceTask = (await db.tasks.get(1))!;
  for (let i = 0; i < 2; i++) await sessionRepository.transaction(tx => tx.createSession({ taskId: 1, itemId: 1, subjectId: 1, date: today(), createdAt: Date.now() + i, marks: sourceTask.plan.map(entry => ({ ...entry, targetBpm: entry.bpm, targetNoteVal: entry.noteVal, confidence: entry.segmentId === 1 ? 5 : 2 })) }));
  const sourceSession = (await db.sessions.toArray()).at(-1)!;
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><BpmSuggestion task={sourceTask} sourceSession={sourceSession} /></I18nContext.Provider>);
  fireEvent.click(screen.getByText(t("tempo.title")));
  const first = (await screen.findByRole("heading", { name: "Sonata · Section 1" })).parentElement!;
  const second = (await screen.findByRole("heading", { name: "Sonata · Section 2" })).parentElement!;
  await waitFor(() => expect(first).toHaveTextContent(/77/));
  expect(first).toHaveTextContent(t("tempo.increase"));
  expect(second).toHaveTextContent(t("tempo.decrease"));
  expect(second).toHaveTextContent(/90/);
  fireEvent.click(within(first).getByRole("button", { name: t("tempo.review") }));
  fireEvent.click(await within(first).findByRole("button", { name: t("tempo.apply", { count: 1 }) }));
  await within(first).findByText(t("tempo.applied"));
  await waitFor(async () => expect((await db.tasks.get(2))!.plan.map(entry => entry.bpm)).toEqual([77, 100]));
  expect((await db.tasks.get(1))!.plan).toEqual(sourceTask.plan);
  expect((await db.sessions.get(sourceSession.id))!.marks).toEqual(sourceSession.marks);
  fireEvent.click(within(second).getByRole("button", { name: t("tempo.review") }));
  fireEvent.click(await within(second).findByRole("button", { name: t("tempo.apply", { count: 1 }) }));
  await within(second).findByText(t("tempo.applied"));
  await waitFor(async () => expect((await db.tasks.get(2))!.plan.map(entry => entry.bpm)).toEqual([77, 90]));
});

it("resolves historical combined subtasks from the session after its task is relinked", async () => {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.library.bulkAdd([1, 2].map(id => ({ id, title: `Piece ${id}`, subjectId: 1, kind: "piece" as const, createdAt: 1 })));
  await db.segments.bulkAdd([1, 2].map(id => ({ id, itemId: id, label: `Section ${id}`, position: 0, layers: [], createdAt: 1 })));
  await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, startDate: today(), weeksAhead: 1, repetitionCap: 1, createdAt: 1, tempoRule: { enabled: true, successes: 2, minConfidence: 4, increase: { kind: "percent", value: 10 } } });
  const plan = [1, 2].map(segmentId => ({ segmentId, layers: [], techniques: [] }));
  const task: Task = { id: 1, title: "Daily Practice", subjectId: 1, itemId: 1, studyRoutineId: 1, date: today(), plan: [plan[0]], done: false, createdAt: 1 };
  await db.tasks.add(task);
  const session = { id: 1, taskId: 1, subjectId: 1, date: today(), marks: plan, createdAt: 1 };
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t: (key, vars) => translate("en", key, vars) }}><BpmSuggestion task={task} sourceSession={session} /></I18nContext.Provider>);
  fireEvent.click(screen.getByText(translate("en", "tempo.title")));
  expect(await screen.findByRole("heading", { name: "Piece 1 · Section 1" })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Piece 2 · Section 2" })).toBeInTheDocument();
});

it("shows a historical initial source and writes only after explicit preview confirmation", async () => {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.library.add({ id: 1, title: "Sonata", subjectId: 1, kind: "piece", createdAt: 1 });
  await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, startDate: today(), weeksAhead: 1, repetitionCap: 1, createdAt: 1 });
  const task = { id: 1, title: "Sonata", subjectId: 1, itemId: 1, studyRoutineId: 1, date: today(), plan: [{ bpm: 80, noteVal: "quarter" as const, layers: [], techniques: [] }], done: false, createdAt: 1 };
  await db.tasks.add(task);
  await db.sessions.add({ id: 1, itemId: 1, date: today(), marks: [{ bpm: 68, noteVal: "eighth", confidence: 4, layers: [], techniques: [] }], createdAt: 1 });
  await tempoProgressionRepository.configure({ kind: "routine",id: 1 },{ enabled: true, successes: 3,minConfidence: 4,increase: { kind: "percent",value: 3 } },Date.now());
  const initialized = vi.fn();
  render(<I18nContext.Provider value={{ lang: "it",setLang: () => {},t: (k,v) => translate("it",k,v) }}><BpmSuggestion task={task} onInitialized={initialized} /></I18nContext.Provider>);
  fireEvent.click(screen.getByText("Progressione del tempo"));
  expect(await screen.findByText(/Ultimo risultato:/)).toHaveTextContent("68");
  fireEvent.click(screen.getByRole("button", { name: /rivedi aggiornamento/i }));
  const confirm = await screen.findByRole("button", { name: /applica a 1 attività/i });
  expect(await db.tempoProgressions.count()).toBe(0);
  fireEvent.click(confirm);
  await waitFor(() => expect(initialized).toHaveBeenCalledOnce());
  expect((await db.tasks.get(1))!.plan[0]).toMatchObject({ bpm: 68,noteVal: "eighth",progression: { cycle: 1,minConfidence: 4 } });
  expect((await db.sessions.get(1))!.marks[0].bpm).toBe(68);
});
