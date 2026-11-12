/* eslint-disable no-restricted-imports -- Uses real queries to check what the user sees. */
import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { tempoContextKey } from "@/domain/logic/tempoProgression";
import { NOTE_GLYPH } from "@/lib/constants";
import type { Task } from "@/domain/entities/task";
import { BpmSuggestion } from "./BpmSuggestion";
import { PracticeMode } from "./PracticeMode";
import { seedSampleData } from "@/lib/sampleData";
import { today } from "@/lib/date";
import { sortDiaryTasks } from "@/lib/domain/taskOrder";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const wrap = (node: React.ReactNode) => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}>{node}</I18nContext.Provider>);
const rule = { enabled: true, successes: 2, minConfidence: 4, increase: { kind: "percent" as const, value: 10 } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function seedSeries(confidences: number[], enabled = true) {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.library.add({ id: 1, title: "Etude", subjectId: 1, kind: "piece", createdAt: 1 });
  const entry = { bpm: 80, noteVal: "quarter" as const, layers: [], techniques: [], progression: { id: 1, cycle: 1, minConfidence: 4 } };
  const template: Task = { id: 1, title: "Etude", subjectId: 1, itemId: 1, date: "2000-01-01", plan: [entry], done: false, createdAt: 1, recurrence: { kind: "interval", everyXDays: 1, startDate: "2000-01-01" }, tempoRule: { ...rule, enabled } };
  const occurrence: Task = { ...template, id: 2, recurrence: undefined, tempoRule: undefined, recurrenceTaskId: 1, date: "2099-01-01" };
  await db.tasks.bulkAdd([template, occurrence]);
  const context = { itemId: 1, layers: [], techniques: [] };
  await db.tempoProgressions.add({ id: 1, owner: { kind: "recurrence", id: 1 }, context, contextKey: tempoContextKey(context), tempo: { bpm: 80, noteVal: "quarter" }, cycle: 1, startedAt: 0, ruleRevision: 0 });
  for (const [i, confidence] of confidences.entries()) await db.sessions.add({ taskId: 1, itemId: 1, date: `2000-01-0${i + 2}`, createdAt: i + 2, marks: [{ ...entry, targetBpm: 80, targetNoteVal: "quarter", confidence }] });
  return occurrence;
}

it("shows the increase suggestion for a series once enough confident sessions are logged", async () => {
  const task = await seedSeries([4, 5]);
  wrap(<BpmSuggestion task={task} />);
  expect(await screen.findByText(`${NOTE_GLYPH.quarter} = 88`, { exact: false })).toBeInTheDocument();
  expect(screen.getByText(t("tempo.increase"), { exact: false })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: t("tempo.review") })).toBeInTheDocument();
});

it("stops suggesting on the first piano fixture task once its target is reached", async () => {
  await seedSampleData();
  configurePresentationQueries(dexiePresentationReads);
  const tasks = sortDiaryTasks(await db.tasks.where("date").equals(today()).toArray(), await db.studyRoutines.toArray(), "routine", "en");
  const task = tasks.find(task => !task.done && !task.skipped && task.deletedAt === undefined);
  if (!task) throw new Error("Missing today's fixture task");
  expect(task.title).toBe("Hanon — Exercise 18");
  expect(task.plan[0]).toMatchObject({ bpm: 104, noteVal: "sixteenth" });
  wrap(<BpmSuggestion task={task} />);
  fireEvent.click(screen.getByText(t("tempo.title")));
  expect((await screen.findAllByText(/104/)).length).toBeGreaterThan(0);
  expect(screen.queryByText(`${t("tempo.increase")}:`, { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByText(`${NOTE_GLYPH.sixteenth} = 108`, { exact: false })).not.toBeInTheDocument();
});

it("hides the suggestion when sessions are not yet confident enough", async () => {
  const task = await seedSeries([4, 3]);
  wrap(<BpmSuggestion task={task} />);
  expect(await screen.findByText(t("tempo.working"), { exact: false })).toBeInTheDocument();
  expect(screen.queryByText(t("tempo.increase"), { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: t("tempo.review") })).not.toBeInTheDocument();
});

it("tells the user progression is off when the series rule is disabled", async () => {
  const task = await seedSeries([5, 5], false);
  wrap(<BpmSuggestion task={task} />);
  expect(await screen.findByText(t("tempo.disabled"))).toBeInTheDocument();
});

it("shows nothing for a one-off task without a routine or series", async () => {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const { container } = wrap(<BpmSuggestion task={{ id: 9, title: "x", subjectId: 1, itemId: 1, date: "2099-01-01", plan: [], done: false, createdAt: 1 }} />);
  expect(container).toBeEmptyDOMElement();
});

it("practice mode offers the series suggestion and applies it to the metronome", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const task = await seedSeries([4, 5]);
  const finish = vi.fn();
  wrap(<PracticeMode task={task} onClose={() => {}} onFinish={finish} />);
  const button = await screen.findByRole("button", { name: t("practice.suggestBpm", { note: NOTE_GLYPH.quarter, bpm: 88 }) });
  expect(button).toHaveClass("text-base", "font-semibold");
  expect(screen.getByText("80")).toHaveClass("text-primary");
  fireEvent.click(button);
  fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
  expect(finish.mock.calls[0][0].marks[0].bpm).toBe(88);
}, 15000);
