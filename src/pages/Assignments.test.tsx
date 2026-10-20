/* eslint-disable no-restricted-imports -- Integration test exercises real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { db } from "@/lib/db";
import { lessonsService } from "@/lib/services";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import Assignments from "./Assignments";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
beforeEach(async () => { await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const show = () => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><Assignments /></MemoryRouter></I18nContext.Provider>);
async function homework(taskIds: number[] = []) {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const lessonId = await db.lessons.add({ subjectId, date: "2026-10-20", createdAt: 1 });
  return db.assignments.add({ lessonId, text: "Practice phrasing", taskIds, createdAt: 1 });
}

it("waits for its reads before showing the empty inbox", async () => {
  show();
  expect(screen.queryByText(t("assignments.allCaughtUp"))).not.toBeInTheDocument();
  expect(await screen.findByText(t("assignments.allCaughtUp"))).toBeInTheDocument();
});

it("returns homework whose only linked task was deleted to the inbox", async () => {
  await homework([999]); show();
  expect(await screen.findByText("Practice phrasing")).toBeInTheDocument();
});

it("finishes a partially linked batch without duplicating saved days", async () => {
  const id = await homework();
  const original = lessonsService.linkTask;
  vi.spyOn(lessonsService, "linkTask").mockImplementationOnce(original).mockRejectedValueOnce(new Error("Disk unavailable"));
  show();
  fireEvent.click(await screen.findByRole("button", { name: t("assignments.makeTask") }));
  const days = screen.getByRole("group", { name: t("assignments.pickDays") }).querySelectorAll("button");
  fireEvent.click(days[0]); fireEvent.click(days[1]);
  fireEvent.click(screen.getByRole("button", { name: t("assignments.create", { count: 2 }) }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(await db.tasks.count()).toBe(2);
  expect((await db.assignments.get(id))?.taskIds).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: t("assignments.create", { count: 1 }) }));
  await waitFor(async () => expect((await db.assignments.get(id))?.taskIds).toHaveLength(2));
  expect(await db.tasks.count()).toBe(2);
  expect(await screen.findByText(t("assignments.allCaughtUp"))).toBeInTheDocument();
});
