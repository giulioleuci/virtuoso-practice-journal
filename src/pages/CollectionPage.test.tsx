/* eslint-disable no-restricted-imports -- Integration test exercises persistence through the real UI. */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { I18nContext, translate } from "@/lib/i18n";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { collectionsService } from "@/lib/services/collections";
import CollectionPage from "./CollectionPage";

const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);
beforeEach(async () => { await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); });

describe("CollectionPage", () => {
  it("shows a mixed index in persisted order and edits link metadata without copying or deleting material", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const collectionId = await collectionsService.create({ kind: "manual", name: "Method", edition: "2026" });
    const ids = await db.library.bulkAdd([
      { subjectId, kind: "theory", studyStatus: "not_started", title: "Z theory", createdAt: 1 },
      { subjectId, kind: "study", studyStatus: "not_started", title: "A study", createdAt: 1 },
      { subjectId, kind: "exercise", studyStatus: "not_started", title: "B exercise", createdAt: 1 },
    ], { allKeys: true });
    await collectionsService.addItems(collectionId, [ids[0], ids[1]]);
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/library/collections/${collectionId}`]}><Routes><Route path="/library/collections/:id" element={<CollectionPage />} /></Routes></MemoryRouter></I18nContext.Provider>);
    await waitFor(() => expect(screen.getByRole("link", { name: "Z theory" })).toBeInTheDocument());
    expect(screen.getAllByRole("link").filter(link => /theory|study/.test(link.textContent ?? "")).map(link => link.textContent)).toEqual(["Z theory", "A study"]);
    const row = within(screen.getByRole("link", { name: "Z theory" }).closest("li")!);
    fireEvent.click(row.getByRole("button", { name: t("segments.moveDown") }));
    await waitFor(async () => expect((await collectionsService.items(collectionId)).map(link => link.itemId)).toEqual([ids[1], ids[0]]));
    fireEvent.click(row.getByRole("button", { name: t("collection.editLink") }));
    fireEvent.change(screen.getByLabelText(t("collection.reference")), { target: { value: "Chapter III" } });
    fireEvent.change(screen.getByLabelText(t("collection.pageStart")), { target: { value: "37" } });
    fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    await waitFor(async () => expect((await collectionsService.items(collectionId))[1]).toMatchObject({ reference: "Chapter III", pageStart: 37 }));
    fireEvent.click(screen.getByRole("button", { name: t("collection.addNamed", { title: "B exercise" }) }));
    await waitFor(async () => expect(await collectionsService.countItems(collectionId)).toBe(3));
    expect(await db.library.count()).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: t("collection.removeNamed", { title: "Z theory" }) }));
    await waitFor(async () => expect(await collectionsService.countItems(collectionId)).toBe(2));
    expect(await db.library.get(ids[0])).toBeDefined();
  });
});
