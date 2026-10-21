/* eslint-disable no-restricted-imports -- Empty-route integration uses real persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { formatDate, today } from "@/lib/date";
import Lessons from "./Lessons";

const t = (key: string) => translate("en", key);
beforeEach(async () => { await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); });
afterEach(cleanup);
it("waits for data before offering an empty lessons state and teacher action", async () => {
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><Lessons /></MemoryRouter></I18nContext.Provider>);
  expect(screen.queryByText(t("lessons.noLessonsLogged"))).not.toBeInTheDocument();
  expect(await screen.findByText(t("lessons.noLessonsLogged"))).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: t("lessons.addRecurrence") })).toHaveLength(2);
});

function Live() { const { search } = useLocation(); return <p>live{search}</p>; }
const showRoutes = () => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter initialEntries={["/lessons"]}>
  <Routes><Route path="/lessons" element={<Lessons />} /><Route path="/lessons/live" element={<Live />} /></Routes>
</MemoryRouter></I18nContext.Provider>);

it("edits a logged lesson on the live page", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const id = await db.lessons.add({ subjectId, date: "2026-10-01", piecesPlayed: [], snapshot: { subjectName: "Piano" }, createdAt: 1 });
  showRoutes();
  fireEvent.click(await screen.findByRole("button", { name: `${t("common.edit")} ${formatDate("2026-10-01", "en")}` }));
  expect(await screen.findByText(`live?lesson=${id}`)).toBeInTheDocument();
});

it("logs a teacher's lesson on the live page for today", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const id = await db.recurrences.add({ subjectId, teacher: "Rossi", schedules: [], startDate: "2020-01-01", color: "sage", createdAt: 1 });
  showRoutes();
  fireEvent.click(await screen.findByRole("button", { name: t("lessons.log") }));
  expect(await screen.findByText(`live?recurrence=${id}&date=${today()}`)).toBeInTheDocument();
});
