/* eslint-disable no-restricted-imports -- Integration test uses real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { PerformanceEventSheet } from "@/components/library/PerformanceEventSheet";
import Repertoire from "./Repertoire";
import ReadinessPage from "./ReadinessPage";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const show = (path: string) => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[path]}><Routes><Route path="/library/repertoire" element={<Repertoire />} /><Route path="/library/events/:id/item/:itemId" element={<ReadinessPage />} /></Routes></MemoryRouter></I18nContext.Provider>);

it("does not show programme readiness under a nonexistent event", async () => {
  const itemId = await db.library.add({ subjectId: 1, kind: "study", title: "Study", createdAt: 1 });
  show(`/library/events/999/item/${itemId}`);
  expect(await screen.findByText(t("readiness.notFound"))).toBeInTheDocument();
});

it("shows the repertoire empty state after its data loads", async () => {
  show("/library/repertoire");
  expect(await screen.findByText(t("repertoire.emptyTitle"))).toBeInTheDocument();
});

it("requires confirmation before deleting an event from the list", async () => {
  const id = await db.performances.add({ name: "Recital", kind: "concert", date: "2099-01-01", createdAt: 1 });
  show("/library/repertoire?tab=performances");
  const menu = await screen.findByRole("button", { name: `${t("common.more")}: Recital` });
  fireEvent.keyDown(menu, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: t("common.delete") }));
  const dialog = await screen.findByRole("alertdialog");
  expect(await db.performances.get(id)).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }));
  expect(await db.performances.get(id)).toBeDefined();
  const error = vi.spyOn(toast, "error");
  vi.spyOn(db.performances, "delete").mockRejectedValueOnce(new Error("Disk unavailable"));
  fireEvent.keyDown(menu, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: t("common.delete") }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("common.delete") }));
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(await db.performances.get(id)).toBeDefined();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: t("common.delete") }));
  await waitFor(async () => expect(await db.performances.get(id)).toBeUndefined());
});

it("retries a failed programme save without creating a second event", async () => {
  await db.library.add({ subjectId: 1, kind: "study", title: "Study", createdAt: 1 });
  const error = vi.spyOn(toast, "error");
  vi.spyOn(db.performanceItems, "bulkAdd").mockRejectedValueOnce(new Error("Disk unavailable"));
  const close = vi.fn();
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PerformanceEventSheet open onOpenChange={close} /></I18nContext.Provider>);
  fireEvent.change(screen.getByPlaceholderText(t("performances.namePlaceholder")), { target: { value: "Recital" } });
  fireEvent.click(await screen.findByRole("checkbox", { name: "Study" }));
  fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(screen.getByRole("alert")).toHaveTextContent(t("performances.programmeSaveFailed"));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(await db.performances.count()).toBe(1);
  expect(await db.performanceItems.count()).toBe(1);
});
