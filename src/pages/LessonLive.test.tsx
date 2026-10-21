/* eslint-disable no-restricted-imports -- Integration test exercises real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { readLiveLesson, setLiveLesson } from "@/lib/liveLesson";
import { lessonsService } from "@/lib/services";
import LessonLive from "./LessonLive";

const t = (key: string) => translate("en", key);
const DATE = "2026-10-21";
let subjectId: number;
let recurrenceId: number;

beforeEach(async () => {
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); localStorage.clear();
  subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  recurrenceId = await db.recurrences.add({ subjectId, teacher: "Rossi", schedules: [{ dayOfWeek: 3, startTime: "17:00", endTime: "18:00", frequency: "weekly" }], startDate: "2026-10-01", color: "sage", createdAt: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };
const renderPage = (path = `/lessons/live?recurrence=${recurrenceId}&date=${DATE}`) => render(
  <I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/lessons/live" element={<><LessonLive /><Where /></>} />
        <Route path="/lessons" element={<p>lessons page</p>} />
      </Routes>
    </MemoryRouter>
  </I18nContext.Provider>,
);
const noteInput = () => screen.findByRole("textbox", { name: t("lessonLive.addNote") });
const homeworkInput = () => screen.getByRole("textbox", { name: t("homework.add") });
const add = (input: HTMLElement, text: string) => { fireEvent.change(input, { target: { value: text } }); fireEvent.submit(input.closest("form")!); };

it("adding a note creates the lesson and lists the note", async () => {
  renderPage();
  add(await noteInput(), "Relax the wrist");
  expect(await screen.findByText("Relax the wrist")).toBeInTheDocument();
  await waitFor(async () => {
    const lessons = await db.lessons.toArray();
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({ subjectId, recurrenceId, date: DATE, notes: [{ text: "Relax the wrist" }] });
  });
  expect(readLiveLesson()).toBe(`/lessons/live?recurrence=${recurrenceId}&date=${DATE}`);
  fireEvent.click(screen.getByRole("button", { name: t("lessonLive.finish") }));
  expect(await screen.findByText("lessons page")).toBeInTheDocument();
  expect(readLiveLesson()).toBeUndefined();
});

it("two quick adds create one lesson", async () => {
  renderPage();
  const notes = await noteInput();
  add(notes, "First");
  fireEvent.submit(notes.closest("form")!); // a second Enter on the same text adds nothing
  add(notes, "Second");
  add(homeworkInput(), "Scales at 80");
  for (const text of ["First", "Second", "Scales at 80"]) expect(await screen.findByText(text)).toBeInTheDocument();
  await waitFor(async () => {
    expect(await db.lessons.count()).toBe(1);
    expect((await db.lessons.toArray())[0].notes?.map((n) => n.text).sort()).toEqual(["First", "Second"]);
    expect((await db.assignments.toArray()).map((a) => a.text)).toEqual(["Scales at 80"]);
  });
});

it("editing a note updates it and an empty edit is rejected", async () => {
  const id = await db.lessons.add({ subjectId, recurrenceId, date: DATE, notes: [{ id: "n1", text: "Old" }], createdAt: 1 });
  renderPage(`/lessons/live?lesson=${id}`);
  fireEvent.click(await screen.findByRole("button", { name: `${t("common.edit")}: Old` }));
  const field = screen.getByRole("textbox", { name: `${t("common.edit")}: Old` });
  fireEvent.change(field, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field).toHaveAccessibleDescription(t("lessonLive.emptyEdit"));
  await waitFor(async () => expect((await db.lessons.get(id))?.notes).toEqual([{ id: "n1", text: "Old" }]));
  fireEvent.change(field, { target: { value: "New" } });
  expect(field).not.toHaveAttribute("aria-invalid", "true");
  fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
  expect(await screen.findByText("New")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: `${t("common.edit")}: New` })).toHaveFocus());
  await waitFor(async () => expect((await db.lessons.get(id))?.notes).toEqual([{ id: "n1", text: "New" }]));
});

it("deleting a homework removes it and undo restores it", async () => {
  const id = await db.lessons.add({ subjectId, recurrenceId, date: DATE, createdAt: 1 });
  const assignmentId = await db.assignments.add({ lessonId: id, text: "Scales", taskIds: [7], ignored: true, createdAt: 5 });
  const before = await db.assignments.get(assignmentId);
  const success = vi.spyOn(toast, "success");
  renderPage(`/lessons/live?lesson=${id}`);
  fireEvent.click(await screen.findByRole("button", { name: `${t("common.delete")}: Scales` }));
  await waitFor(() => expect(success).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Scales")).not.toBeInTheDocument());
  await waitFor(async () => expect(await db.assignments.count()).toBe(0));
  const [message, options] = success.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
  expect(message).toBe(t("lessonLive.removed"));
  expect(options.action.label).toBe(t("common.undo"));
  options.action.onClick();
  expect(await screen.findByText("Scales")).toBeInTheDocument();
  await waitFor(async () => expect(await db.assignments.toArray()).toEqual([before]));
});

it("unsent text is restored after remount", async () => {
  const first = renderPage();
  fireEvent.change(await noteInput(), { target: { value: "Half typed" } });
  fireEvent.change(homeworkInput(), { target: { value: "Homework typed" } });
  first.unmount();
  const second = renderPage();
  expect(await noteInput()).toHaveValue("Half typed");
  expect(homeworkInput()).toHaveValue("Homework typed");
  fireEvent.submit((await noteInput()).closest("form")!);
  expect(await screen.findByText("Half typed")).toBeInTheDocument();
  second.unmount();
  renderPage();
  expect(await noteInput()).toHaveValue("");
  expect(homeworkInput()).toHaveValue("Homework typed");
});

it("date change on an existing lesson moves it, collision shows an alert", async () => {
  const id = await db.lessons.add({ subjectId, recurrenceId, date: DATE, notes: [{ id: "n1", text: "Existing note" }], createdAt: 1 });
  await db.lessons.add({ subjectId, recurrenceId, date: "2026-10-28", createdAt: 2 });
  renderPage();
  await screen.findByText("Existing note");
  const date = screen.getByLabelText(t("common.date"));
  fireEvent.change(date, { target: { value: "2026-10-22" } });
  fireEvent.blur(date);
  await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("date=2026-10-22"));
  await waitFor(async () => expect((await db.lessons.get(id))?.date).toBe("2026-10-22"));
  expect(readLiveLesson()).toBe(`/lessons/live?recurrence=${recurrenceId}&date=2026-10-22`);
  await screen.findByText("Existing note");
  date.focus();
  fireEvent.change(date, { target: { value: "2026-10-28" } });
  fireEvent.keyDown(date, { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent(t("lessonLive.dateTaken"));
  expect(date).toHaveAccessibleDescription(t("lessonLive.dateTaken"));
  await waitFor(async () => expect((await db.lessons.get(id))?.date).toBe("2026-10-22"));
  expect(date).toHaveValue("2026-10-22");
  expect(screen.getByTestId("where")).toHaveTextContent("date=2026-10-22");
});

it("typing a date commits it only when the field is left", async () => {
  const id = await db.lessons.add({ subjectId, recurrenceId, date: DATE, notes: [{ id: "n1", text: "Existing note" }], createdAt: 1 });
  const setDate = vi.spyOn(lessonsService, "setDate");
  renderPage();
  await screen.findByText("Existing note");
  const date = screen.getByLabelText(t("common.date"));
  for (const value of ["0002-10-22", "0202-10-22", "2026-10-22"]) fireEvent.change(date, { target: { value } });
  expect(date).toHaveValue("2026-10-22");
  expect(setDate).not.toHaveBeenCalled();
  expect(screen.getByTestId("where")).toHaveTextContent(`date=${DATE}`);
  fireEvent.blur(date);
  await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("date=2026-10-22"));
  expect(setDate).toHaveBeenCalledTimes(1);
  expect(setDate).toHaveBeenCalledWith(id, "2026-10-22");
  await waitFor(async () => expect((await db.lessons.get(id))?.date).toBe("2026-10-22"));
});

it("date change on a slot with no lesson only changes the address", async () => {
  renderPage();
  const date = (await screen.findByLabelText(t("common.date")));
  await noteInput();
  fireEvent.change(date, { target: { value: "2026-10-23" } });
  fireEvent.blur(date);
  await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("date=2026-10-23"));
  expect(readLiveLesson()).toBe(`/lessons/live?recurrence=${recurrenceId}&date=2026-10-23`);
  await waitFor(async () => expect(await db.lessons.count()).toBe(0));
});

it("deleted recurrence in the pointer clears the pointer", async () => {
  const path = `/lessons/live?recurrence=${recurrenceId}&date=${DATE}`;
  await db.recurrences.delete(recurrenceId);
  setLiveLesson(path);
  renderPage(path);
  expect(await screen.findByText("lessons page")).toBeInTheDocument();
  expect(readLiveLesson()).toBeUndefined();
});
