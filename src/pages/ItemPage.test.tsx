/* eslint-disable no-restricted-imports -- Integration test uses real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import ItemPage from "./ItemPage";
import { ItemQuestions } from "@/components/library/ItemHelpSheet";
import { toast } from "sonner";

const t = (key: string) => translate("en", key);
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const show = (id: number) => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/library/item/${id}`]}><Routes><Route path="/library/item/:id" element={<ItemPage />} /></Routes></MemoryRouter></I18nContext.Provider>);

it("shows a recovery state when a material does not exist", async () => {
  show(999);
  expect(await screen.findByText(t("item.notFound"))).toBeInTheDocument();
});

it("opens sections with the keyboard and shows an actionable empty state", async () => {
  const id = await db.library.add({ subjectId: 1, kind: "piece", title: "Prelude", createdAt: 1 });
  show(id);
  const overview = await screen.findByRole("tab", { name: t("item.tab.overview") });
  act(() => overview.focus());
  fireEvent.keyDown(overview, { key: "ArrowRight" });
  await waitFor(() => expect(screen.getByRole("tab", { name: t("item.tab.segments") })).toHaveAttribute("aria-selected", "true"));
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName(t("item.tab.segments"));
  expect(screen.getByText(t("item.noSegments"))).toBeInTheDocument();
});

it("exposes confidence observations in date order, including backdated sessions", async () => {
  const id = await db.library.add({ subjectId: 1, kind: "piece", title: "Prelude", createdAt: 1 });
  await db.sessions.bulkAdd([
    { itemId: id, date: "2026-10-02", createdAt: 1, marks: [{ confidence: 5, layers: [], techniques: [] }] },
    { itemId: id, date: "2026-10-01", createdAt: 2, marks: [{ confidence: 1, layers: [], techniques: [] }] },
  ]);
  show(id);
  fireEvent.mouseDown(await screen.findByRole("tab", { name: t("item.tab.analysis") }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByText(`${t("analysis.dataTable")}: ${t("analysis.confidenceTrend")}`));
  const table = await screen.findByRole("table", { name: t("analysis.confidenceTrend") });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows.map(row => within(row).getAllByRole("cell")[1].textContent)).toEqual(["1", "5"]);
});

it("keeps a question after a failed write and retries without duplicating it", async () => {
  const error = vi.spyOn(toast, "error");
  vi.spyOn(db.helpRequests, "add").mockRejectedValueOnce(new Error("Disk unavailable"));
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><ItemQuestions itemId={1} /></I18nContext.Provider>);
  const draft = screen.getByPlaceholderText(t("help.questionPlaceholder"));
  fireEvent.change(draft, { target: { value: "How should I pedal this?" } });
  fireEvent.click(screen.getByRole("button", { name: t("help.newQuestion") }));
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(draft).toHaveValue("How should I pedal this?");
  fireEvent.click(screen.getByRole("button", { name: t("help.newQuestion") }));
  fireEvent.click(screen.getByRole("button", { name: t("help.newQuestion") }));
  await waitFor(async () => expect(await db.helpRequests.count()).toBe(1));
  await waitFor(() => expect(draft).toHaveValue(""));
});
