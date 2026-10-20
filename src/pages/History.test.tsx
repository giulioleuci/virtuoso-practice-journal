/* eslint-disable no-restricted-imports -- Integration test exercises the real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import History from "./History";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open();
  configurePresentationQueries(dexiePresentationReads);
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  for (let i = 0; i < 8; i++) await db.sessions.add({ subjectId, date: "2026-10-19", marks: [{ confidence: 3, layers: [], techniques: [] }], snapshot: { taskTitle: `Take ${i + 1}`, subjectName: "Piano" }, createdAt: i + 1 } as never);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("lists every session of a group as a link, expanding past the first six", async () => {
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><History /></MemoryRouter></I18nContext.Provider>);
  fireEvent.click(await screen.findByRole("button", { name: /8 sessions/ }));
  const region = screen.getByRole("region");
  expect(within(region).getAllByRole("link")).toHaveLength(6);
  fireEvent.click(within(region).getByRole("button", { name: t("history.more", { count: 2 }) }));
  const links = within(region).getAllByRole("link");
  expect(links).toHaveLength(8);
  expect(links[0].getAttribute("href")).toMatch(/^\/sessions\/\d+$/);
});

it("counts a session under every section it marks and keeps a deleted material's name", async () => {
  await db.sessions.clear();
  const subjectId = (await db.subjects.toArray())[0].id!;
  const itemId = await db.library.add({ subjectId, kind: "piece", title: "Ballade", createdAt: 1, deletedAt: 9 } as never);
  await db.sessions.add({ subjectId, itemId, date: "2026-10-19", marks: [{ segmentId: 1, layers: [], techniques: [] }, { segmentId: 2, layers: [], techniques: [] }], snapshot: { taskTitle: "Ballade", subjectName: "Piano", itemTitle: "Ballade", segments: [{ id: "1", label: "Intro" }, { id: "2", label: "Coda" }] }, createdAt: 1 } as never);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><History /></MemoryRouter></I18nContext.Provider>);
  fireEvent.mouseDown(await screen.findByRole("tab", { name: t("history.groupSegment") }), { button: 0 });
  expect(await screen.findByRole("button", { name: /Intro/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Coda/ })).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: t("history.groupItem") }), { button: 0 });
  expect(await screen.findByRole("button", { name: /Ballade/ })).toBeInTheDocument();
});
