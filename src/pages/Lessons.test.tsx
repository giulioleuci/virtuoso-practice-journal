/* eslint-disable no-restricted-imports -- Empty-route integration uses real persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
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
