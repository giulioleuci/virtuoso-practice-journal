/* eslint-disable no-restricted-imports -- Integration test uses real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import SegmentPage from "./SegmentPage";

const t = (key: string) => translate("en", key);
let itemId: number, segmentId: number;
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  itemId = await db.library.add({ subjectId: 1, kind: "piece", title: "Prelude", targetBpm: 132, noteVal: "sixteenth", createdAt: 1 });
  segmentId = await db.segments.add({ itemId, label: "A", position: 0, layers: [], createdAt: 1 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const show = () => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/library/item/${itemId}/segment/${segmentId}`]}><Routes><Route path="/library/item/:id/segment/:segmentId" element={<SegmentPage />} /></Routes></MemoryRouter></I18nContext.Provider>);

it("shows an inherited complete tempo and a useful empty history", async () => {
  show();
  expect(await screen.findByText(/𝅘𝅥𝅯 = 132/)).toBeInTheDocument();
  expect(screen.getByText(t("segments.inherited"), { exact: false })).toBeInTheDocument();
  expect(await screen.findByText(t("segment.emptyTitle"))).toBeInTheDocument();
});

it("preserves the section's own note value in its history target", async () => {
  await db.segments.update(segmentId, { targetBpm: 80, noteVal: "eighth" });
  await db.sessions.add({ itemId, date: "2026-10-01", createdAt: 1, marks: [{ segmentId, bpm: 60, noteVal: "eighth", layers: [], techniques: [] }] });
  show();
  expect(await screen.findByText(`${t("library.targetTempo")}: ♪ = 80`)).toBeInTheDocument();
});

it("offers recovery instead of planning for a deleted parent", async () => {
  await db.library.update(itemId, { deletedAt: 2 });
  show();
  expect(await screen.findByText(t("segment.notFound"))).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: t("library.practiceThis") })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: t("item.back") })).toBeInTheDocument();
});
