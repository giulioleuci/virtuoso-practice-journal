/* eslint-disable no-restricted-imports -- Integration test exercises the real local persistence. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import Tasks from "./Tasks";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open();
  configurePresentationQueries(dexiePresentationReads);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("offers adding several materials at once from the library", async () => {
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><MemoryRouter><Tasks /></MemoryRouter></I18nContext.Provider>);
  expect(await screen.findByRole("link", { name: t("bulk.title") })).toHaveAttribute("href", "/tasks/bulk");
});
