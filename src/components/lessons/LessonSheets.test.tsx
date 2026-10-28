/* eslint-disable no-restricted-imports -- Integration test exercises real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { RecurrenceSheet } from "./RecurrenceSheet";
import { TeacherRecapSheet } from "./TeacherRecapSheet";
import { MemoryRouter } from "react-router-dom";

const t = (key: string) => translate("en", key);
beforeEach(async () => { await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps teacher edits when recurrence storage fails", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const id = await db.recurrences.add({ subjectId, teacher: "Teacher", schedules: [{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00", frequency: "weekly" }], startDate: "2026-10-01", color: "sage", createdAt: 1 });
  const recurrence = (await db.recurrences.get(id))!;
  const close = vi.fn();
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><RecurrenceSheet open onOpenChange={close} recurrence={recurrence} /></I18nContext.Provider>);
  const teacher = screen.getByPlaceholderText(t("common.name"));
  fireEvent.change(teacher, { target: { value: "Teacher updated" } });
  const start = screen.getByLabelText(t("teacher.start"));
  fireEvent.change(start, { target: { value: "" } });
  expect(screen.getByRole("button", { name: t("common.save") })).toBeDisabled();
  fireEvent.change(start, { target: { value: "17:00" } });
  vi.spyOn(db.recurrences, "put").mockRejectedValueOnce(new Error("Disk unavailable"));
  fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
  expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.couldNotSave"));
  expect(teacher).toHaveValue("Teacher updated");
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect((await db.recurrences.get(id))?.teacher).toBe("Teacher updated");
});

it("keeps an unsaved teacher answer after a storage error", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const itemId = await db.library.add({ subjectId, kind: "piece", title: "Prelude", createdAt: 1 });
  const id = await db.helpRequests.add({ itemId, question: "How to pedal?", resolved: false, createdAt: 1 });
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><TeacherRecapSheet open onOpenChange={() => {}} /></MemoryRouter></I18nContext.Provider>);
  fireEvent.click(await screen.findByRole("button", { name: /Prelude/ }));
  fireEvent.click(screen.getByRole("button", { name: t("recap.recordAnswer") }));
  const answer = screen.getByPlaceholderText(t("recap.answerPlaceholder"));
  fireEvent.change(answer, { target: { value: "Change pedal on the harmony" } });
  vi.spyOn(db.helpRequests, "update").mockRejectedValueOnce(new Error("Disk unavailable"));
  fireEvent.click(screen.getByRole("button", { name: t("recap.saveAnswer") }));
  expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.couldNotSave"));
  expect(answer).toHaveValue("Change pedal on the harmony");
  fireEvent.click(screen.getByRole("button", { name: t("recap.saveAnswer") }));
  await waitFor(async () => expect((await db.helpRequests.get(id))?.answer).toBe("Change pedal on the harmony"));
});

it("keeps questions for equally titled materials in separate accordions", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const ids = await db.library.bulkAdd([{ subjectId, kind: "piece", title: "Study", createdAt: 1 }, { subjectId, kind: "study", title: "Study", createdAt: 2 }], { allKeys: true });
  await db.helpRequests.bulkAdd([{ itemId: ids[0], question: "First question", resolved: false, createdAt: 2 }, { itemId: ids[1], question: "Second question", resolved: false, createdAt: 1 }]);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><TeacherRecapSheet open onOpenChange={() => {}} /></MemoryRouter></I18nContext.Provider>);
  const materials = await screen.findAllByRole("button", { name: /Study/ });
  fireEvent.click(materials[0]);
  expect(await screen.findByText("First question")).toBeVisible();
  expect(screen.queryByText("Second question")).not.toBeInTheDocument();
});
