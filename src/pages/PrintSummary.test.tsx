/* eslint-disable no-restricted-imports -- Weekly report integration exercises real reads. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import PrintSummary from "./PrintSummary";

const platform = vi.hoisted(() => ({ android: false, printHtml: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/platform", () => ({ isAndroid: () => platform.android, printHtml: platform.printHtml }));

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T12:00:00"));
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.profile.add({ id: "me", name: "Musician", lang: "en", reminderTime: "18:00", reminderFreq: "daily", reminderDays: [], lateRecoveryDays: 2, graceDay: true, groupByPhase: false, onboarded: true, weekStartsOn: 0, createdAt: 1 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const show = (path = "/print/weekly") => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={[path]}><PrintSummary /></MemoryRouter></I18nContext.Provider>);

it("waits for data before offering the empty weekly report", async () => {
  show(); expect(screen.queryByText(t("print.noPieces"))).not.toBeInTheDocument();
  expect(await screen.findByText(t("print.noPieces"))).toBeInTheDocument();
});

it("keeps equally named materials separate and respects a Sunday week start", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const ids = await db.library.bulkAdd([{ subjectId, title: "Study", kind: "piece", createdAt: 1 }, { subjectId, title: "Study", kind: "study", createdAt: 1 }], { allKeys: true });
  await db.sessions.bulkAdd([{ itemId: ids[0], subjectId, date: "2026-10-18", notes: "Sunday practice", marks: [], createdAt: 1 }, { itemId: ids[1], subjectId, date: "2026-10-20", marks: [], createdAt: 2 }]);
  show();
  const table = await screen.findByRole("table");
  expect(within(table).getAllByText("Study")).toHaveLength(2);
  expect(within(table).getAllByText(t("history.sessions", { count: 1 }))).toHaveLength(2);
  expect(screen.getByText("Sunday practice")).toBeInTheDocument();
});

it("offers a recovery action for an unknown subject instead of an empty report", async () => {
  show("/print/weekly?subject=999");
  expect(await screen.findByText(t("subjects.notFound"))).toBeInTheDocument();
  expect(screen.getByRole("link", { name: t("library.allSubjects") })).toHaveAttribute("href", "/print/weekly");
});

it("covers the days since the last lesson by default and the calendar week when switched off", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const itemId = await db.library.add({ subjectId, title: "Etude", kind: "piece", createdAt: 1 });
  await db.lessons.add({ subjectId, date: "2026-10-14", createdAt: 1 });
  await db.sessions.bulkAdd([{ itemId, subjectId, date: "2026-10-14", marks: [], createdAt: 1 }, { itemId, subjectId, date: "2026-10-15", marks: [], createdAt: 2 }, { itemId, subjectId, date: "2026-10-20", marks: [], createdAt: 3 }]);
  show();
  expect(await screen.findByText(t("history.sessions", { count: 2 }))).toBeInTheDocument();
  expect(screen.getByText("2 / 6")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch"));
  expect(await screen.findByText(t("history.sessions", { count: 1 }))).toBeInTheDocument();
});

it("prints through the native plugin on Android and window.print elsewhere", async () => {
  const print = vi.fn(); vi.stubGlobal("print", print);
  show(); const button = await screen.findByRole("button", { name: t("print.print") });
  fireEvent.click(button); expect(print).toHaveBeenCalledTimes(1); expect(platform.printHtml).not.toHaveBeenCalled();
  platform.android = true; fireEvent.click(button);
  expect(platform.printHtml).toHaveBeenCalledWith(expect.stringContaining("print-summary"), t("print.title")); expect(print).toHaveBeenCalledTimes(1);
  platform.android = false; vi.unstubAllGlobals();
});
