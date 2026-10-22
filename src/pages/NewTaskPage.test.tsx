/* eslint-disable no-restricted-imports -- Integration test exercises the real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import NewTaskPage from "./NewTaskPage";
import EditTaskPage from "./EditTaskPage";

const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);
let subjectId: number, itemId: number, segmentIds: number[];
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open();
  configurePresentationQueries(dexiePresentationReads);
  subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  itemId = await db.library.add({ subjectId, kind: "piece", title: "Ballata", createdAt: 1 });
  segmentIds = [await db.segments.add({ itemId, label: "A", position: 0, layers: [], createdAt: 1 }), await db.segments.add({ itemId, label: "B", position: 1, layers: [], createdAt: 1 })];
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const show = (path: string, state?: unknown) => render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}>
  <MemoryRouter initialEntries={[{ pathname: path, state }]}><Routes>
    <Route path="/tasks/new" element={<NewTaskPage />} /><Route path="/tasks/edit/:id" element={<EditTaskPage />} />
  </Routes></MemoryRouter></I18nContext.Provider>);

it("names every field, stays calm until submit, then points at what is missing", async () => {
  show("/tasks/new");
  expect(await screen.findByRole("combobox", { name: t("common.subject") })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: t("common.title") })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: t("tasks.executionNotes") })).toBeInTheDocument();
  expect(document.getElementById("task-errors")).toBeNull();
  const add = screen.getByRole("button", { name: t("tasks.addTask") });
  expect(add).toBeEnabled();
  fireEvent.click(add);
  const subject = screen.getByRole("combobox", { name: t("common.subject") });
  await waitFor(() => expect(subject).toHaveFocus());
  expect(subject).toHaveAttribute("aria-invalid", "true");
  expect(subject).toHaveAttribute("aria-describedby", "task-errors");
  expect(document.getElementById("task-errors")).toHaveTextContent(t("errors.pickSubject"));
  expect(await db.tasks.count()).toBe(0);
});

it("titles a multi-section task in the app language", async () => {
  show("/tasks/new", { prefill: { itemSubjectId: subjectId, itemId, segmentIds } });
  await waitFor(() => expect(screen.getByRole("textbox", { name: t("common.title") })).toHaveValue(`Ballata — ${t("library.segments", { count: 2 })}`));
});

it("plans theory work with the subject's custom aspects", async () => {
  await db.subjects.update(subjectId, { type: "theory", layers: ["Contesto storico", "Ascolto"] });
  await db.library.update(itemId, { kind: "theory" });
  show("/tasks/new", { prefill: { itemSubjectId: subjectId, itemId } });
  await screen.findByRole("button", { name: t("common.removeItem", { label: "Contesto storico" }) });
  expect(screen.queryByText("library.mastery.Contesto storico")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t("common.removeItem", { label: "Ascolto" }) }));
  fireEvent.click(screen.getByRole("button", { name: t("tasks.addTask") }));
  await waitFor(async () => expect((await db.tasks.toArray())[0]?.plan[0].layers).toEqual(["Contesto storico"]));
});

it("labels the edit form the same way", async () => {
  const id = await db.tasks.add({ subjectId, title: "Scale", date: "2026-10-20", plan: [], done: false, createdAt: 1 });
  show(`/tasks/edit/${id}`);
  expect(await screen.findByRole("textbox", { name: t("common.title") })).toHaveValue("Scale");
  expect(screen.getByRole("combobox", { name: t("common.subject") })).toBeInTheDocument();
});

it("schedules a one-off task on the day picked in the form", async () => {
  show("/tasks/new", { prefill: { itemSubjectId: subjectId, itemId } });
  await waitFor(() => expect(screen.getByRole("textbox", { name: t("common.title") })).toHaveValue("Ballata"));
  fireEvent.change(screen.getByLabelText(t("common.date")), { target: { value: "2026-11-03" } });
  fireEvent.click(screen.getByRole("button", { name: t("tasks.addTask") }));
  await waitFor(async () => expect((await db.tasks.toArray())[0]?.date).toBe("2026-11-03"));
});

it("keeps a title the musician typed when the sections change", async () => {
  show("/tasks/new", { prefill: { itemSubjectId: subjectId, itemId, segmentIds } });
  const title = screen.getByRole("textbox", { name: t("common.title") });
  await waitFor(() => expect(title).toHaveValue(`Ballata — ${t("library.segments", { count: 2 })}`));
  fireEvent.change(title, { target: { value: "Solo la ripresa" } });
  fireEvent.click(await screen.findByRole("button", { name: t("common.removeItem", { label: "B" }) }));
  await new Promise((r) => setTimeout(r, 50));
  expect(title).toHaveValue("Solo la ripresa");
});

it("names the repeat switch and every weekday, with their state", async () => {
  show("/tasks/new");
  fireEvent.click(await screen.findByRole("switch", { name: t("recurrence.repeat") }));
  const monday = screen.getByRole("button", { name: t("weekday.1") });
  expect(monday).toHaveAttribute("aria-pressed");
  expect(monday).toHaveClass("h-11");
});

it("says that editing one day of a series leaves the other days alone", async () => {
  const first = await db.tasks.add({ subjectId, title: "Scale", date: "2026-10-20", plan: [], done: false, createdAt: 1, recurrence: { kind: "interval", everyXDays: 1, startDate: "2026-10-20", occurrences: 3 } } as never);
  const id = await db.tasks.add({ subjectId, title: "Scale", date: "2026-10-21", plan: [], done: false, createdAt: 1, recurrenceTaskId: first } as never);
  show(`/tasks/edit/${id}`);
  expect(await screen.findByText(/Cambia solo questo giorno/)).toBeInTheDocument();
});

it("saves progression only on the recurrence root and blocks an invalid numeric draft", async () => {
  show("/tasks/new",{ prefill: { itemSubjectId: subjectId,itemId } });
  await waitFor(() => expect(screen.getByRole("textbox",{ name:t("common.title") })).toHaveValue("Ballata"));
  fireEvent.click(screen.getByRole("switch",{ name:t("recurrence.repeat") }));
  fireEvent.click(screen.getByRole("switch",{ name:t("tempo.title") }));
  fireEvent.change(screen.getByLabelText(t("tempo.window")),{ target:{ value:"1" } });
  expect(screen.getByRole("button",{ name:t("tasks.addTask") })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(t("tempo.window")),{ target:{ value:"" } });
  fireEvent.click(screen.getByRole("button",{ name:t("tasks.addTask") }));
  await waitFor(async () => expect(await db.tasks.count()).toBeGreaterThan(1));
  const tasks=await db.tasks.toArray(),root=tasks.find(task=>task.recurrence)!;
  expect(root.tempoRule).toMatchObject({ enabled:true,successes:3,minConfidence:4 });
  expect(root.tempoRule?.window).toBeUndefined();
  expect(tasks.filter(task=>task.recurrenceTaskId).every(task=>task.tempoRule===undefined && task.tempoRuleRevision===undefined)).toBe(true);
});
