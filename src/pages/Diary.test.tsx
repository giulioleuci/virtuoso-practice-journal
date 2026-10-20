/* eslint-disable no-restricted-imports -- Integration test exercises the real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { today } from "@/lib/date";
import type { Profile } from "@/domain/entities/profile";
import Diary from "./Diary";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
let subjectId: number;
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open();
  configurePresentationQueries(dexiePresentationReads);
  subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function show() {
  const profile = { id: "me", name: "Clara", hideHeroQuote: true } as Profile;
  return render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter>
    <Routes><Route element={<Outlet context={{ profile }} />}><Route index element={<Diary />} /></Route></Routes>
  </MemoryRouter></I18nContext.Provider>);
}

it("shows a free session logged today instead of an empty day with a 0/0 bar", async () => {
  const id = await db.sessions.add({ subjectId, date: today(), marks: [{ confidence: 4 }], snapshot: { taskTitle: "Sight reading", subjectName: "Piano" }, createdAt: 1 } as never);
  show();
  expect(await screen.findByRole("link", { name: /Sight reading/ })).toHaveAttribute("href", `/sessions/${id}`);
  expect(screen.queryByText(t("diary.doneSummary", { done: 0, total: 0 }))).not.toBeInTheDocument();
});

it("names each row's log link by its task and announces a completion", async () => {
  await db.tasks.add({ subjectId, title: "Hanon 1", date: today(), plan: [], done: false, createdAt: 1 });
  show();
  expect(await screen.findByRole("link", { name: `${t("diary.logResults")}: Hanon 1` })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t("tasks.markDone") }));
  expect(await screen.findByRole("status")).toHaveTextContent("Hanon 1");
});

it("reopens a task with nothing logged without a destructive warning", async () => {
  await db.tasks.add({ subjectId, title: "Hanon 2", date: today(), plan: [], done: true, createdAt: 1 });
  show();
  fireEvent.click(await screen.findByRole("button", { name: t("diary.markNotDone") }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await waitFor(async () => expect((await db.tasks.toArray())[0].done).toBe(false));
});

it("labels the week arrows by the distance they move", async () => {
  show();
  expect(await screen.findByRole("button", { name: "Previous week" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument();
});
