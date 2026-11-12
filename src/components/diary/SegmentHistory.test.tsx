/* eslint-disable no-restricted-imports -- Uses real queries to check what the user sees. */
import "fake-indexeddb/auto";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import type { ClickLevel } from "@/domain/constants/clickLevels";
import { SegmentHistory } from "./SegmentHistory";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function show(click: ClickLevel) {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.library.add({ id: 1, title: "Etude", subjectId: 1, kind: "piece", createdAt: 1 });
  await db.sessions.add({ taskId: 1, itemId: 1, date: "2026-10-17", createdAt: 1, tempoSegmentIds: [5], marks: [{ segmentId: 5, bpm: 60, noteVal: "quarter", confidence: 4, click, layers: [], techniques: [] }] });
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><SegmentHistory itemId={1} segmentId={5} /></MemoryRouter></I18nContext.Provider>);
  await screen.findByText(t("segment.observations", { count: 1 }));
}

it("shows the click level next to the tempo", async () => {
  await show("bar2");
  expect(screen.getByText(t("click.bar2"))).toBeInTheDocument();
});
it("shows no click label at the default level", async () => {
  await show("all");
  expect(screen.queryByText(t("click.all"))).not.toBeInTheDocument();
});
