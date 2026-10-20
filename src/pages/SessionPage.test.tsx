/* eslint-disable no-restricted-imports -- Integration test exercises the real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { formatDate } from "@/lib/date";
import SessionPage from "./SessionPage";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
let subjectId: number, itemId: number;
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open();
  configurePresentationQueries(dexiePresentationReads);
  subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  itemId = await db.library.add({ subjectId, kind: "piece", title: "Ballade", createdAt: 1 });
  await db.tasks.add({ subjectId, title: "Ballade", itemId, linkType: "item", date: "2099-01-01", plan: [{ bpm: 70, noteVal: "quarter", layers: [], techniques: [] }], done: false, createdAt: 1 } as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const session = (date: string, bpm: number, createdAt = 1) => db.sessions.add({ subjectId, itemId, linkType: "item", date, marks: [{ bpm, noteVal: "quarter", confidence: 3, layers: [], techniques: [] }], snapshot: { taskTitle: "Ballade", subjectName: "Piano", itemTitle: "Ballade" }, createdAt } as never);
const show = (id: number) => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/sessions/${id}`]}><Routes><Route path="/sessions/:id" element={<SessionPage />} /></Routes></MemoryRouter></I18nContext.Provider>);

it("says when the session happened", async () => {
  show(await session("2026-09-20", 60));
  expect(await screen.findByText(formatDate("2026-09-20", "en", "long"))).toBeInTheDocument();
});

it("never pre-selects a slower reached tempo as the next target, and Apply can be undone", async () => {
  const success = vi.spyOn(toast, "success");
  show(await session("2026-09-20", 60));
  const use = await screen.findByRole("checkbox", { name: t("nextTask.useAsTarget") });
  expect(use).not.toBeChecked();
  fireEvent.click(use);
  fireEvent.click(screen.getByRole("button", { name: t("nextTask.apply") }));
  await waitFor(() => expect(success).toHaveBeenCalled());
  const undo = (success.mock.calls[0][1] as { action: { label: string; onClick: () => void } }).action;
  expect(undo.label).toBe(t("common.undo"));
  undo.onClick();
  await waitFor(async () => expect((await db.tasks.toArray())[0].plan[0].bpm).toBe(70));
});

it("offers to update the next task only from the latest session of the material", async () => {
  const older = await session("2026-09-20", 60);
  await session("2026-10-01", 72, 2);
  show(older);
  await screen.findByText(formatDate("2026-09-20", "en", "long"));
  expect(screen.queryByRole("heading", { name: t("nextTask.title") })).not.toBeInTheDocument();
});

it("keeps a deleted material as plain text instead of a dead link", async () => {
  const id = await session("2026-09-20", 60);
  await db.library.update(itemId, { deletedAt: 5 });
  show(id);
  await screen.findByRole("heading", { name: "Ballade", level: 1 });
  await waitFor(() => expect(screen.getAllByText("Ballade").length).toBeGreaterThan(1));
  expect(document.querySelector(`a[href="/library/item/${itemId}"]`)).toBeNull();
});
