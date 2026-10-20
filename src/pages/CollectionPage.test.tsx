/* eslint-disable no-restricted-imports -- Integration test exercises persistence through the real UI. */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { I18nContext, translate } from "@/lib/i18n";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { collectionsService } from "@/lib/services/collections";
import CollectionPage from "./CollectionPage";
import { NewCollectionSheet } from "@/components/collections/NewCollectionSheet";

const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);
beforeEach(async () => { Element.prototype.scrollIntoView = vi.fn(); await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); });

describe("CollectionPage", () => {
  it("recovers from a missing collection instead of staying in loading", async () => {
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><MemoryRouter initialEntries={["/library/collections/999"]}><Routes><Route path="/library/collections/:id" element={<CollectionPage />} /></Routes></MemoryRouter></I18nContext.Provider>);
    expect(await screen.findByText(t("collection.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("collection.all") })).toBeInTheDocument();
  });

  it("labels collection fields and exposes the selected color", async () => {
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><NewCollectionSheet open onOpenChange={() => {}} kind="manual" /></I18nContext.Provider>);
    expect(screen.getByRole("textbox", { name: t("library.labelAuthor") })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: t("collections.labelCatalog") })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: t("collections.labelNotesOptional") })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: t("collections.labelDefaultSubject") })).toBeInTheDocument();
    const sage = screen.getByRole("button", { name: t("subjects.color.sage") });
    fireEvent.click(sage);
    expect(sage).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: t("common.name") }), { target: { value: "Method" } });
    fireEvent.click(screen.getByRole("button", { name: t("collections.createCollection") }));
    await waitFor(async () => expect(await db.collections.toArray()).toMatchObject([{ name: "Method", color: "sage", kind: "manual" }]));
  });

  it("paginates library candidates, resets filters and keeps a valid page after adding the last candidate", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const collectionId = await collectionsService.create({ kind: "collection", name: "Collection" });
    await db.library.bulkAdd(Array.from({ length: 11 }, (_, index) => ({
      subjectId, kind: "piece" as const,
      title: `Material ${String(index + 1).padStart(2, "0")}`,
      composer: index < 6 ? "Author A" : "Author B", createdAt: 1,
    })));
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/library/collections/${collectionId}`]}><Routes><Route path="/library/collections/:id" element={<CollectionPage />} /></Routes></MemoryRouter></I18nContext.Provider>);
    await screen.findByText("1 / 3");
    expect(screen.getAllByRole("button", { name: /^Aggiungi Material/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Pagina precedente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    expect(screen.getByText("Material 06")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Material" } });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    fireEvent.click(screen.getByRole("button", { name: /Filtri/ }));
    fireEvent.keyDown(screen.getByLabelText(t("collection.author")), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("option", { name: "Author A" }), { key: "Enter" });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Material 01")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText(t("collection.author")), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getAllByRole("option")[0], { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagina successiva" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: t("collection.addNamed", { title: "Material 11" }) }));
    await screen.findByRole("link", { name: "Material 11" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Aggiungi Material/ })).toHaveLength(5);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
    expect(screen.getByText(t("collection.noCandidates"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagina successiva" })).not.toBeInTheDocument();
  });

  it("shows a mixed index in persisted order and edits link metadata without copying or deleting material", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const collectionId = await collectionsService.create({ kind: "manual", name: "Method", edition: "2026" });
    const ids = await db.library.bulkAdd([
      { subjectId, kind: "theory", title: "Z theory", createdAt: 1 },
      { subjectId, kind: "study", title: "A study", createdAt: 1 },
      { subjectId, kind: "exercise", title: "B exercise", createdAt: 1 },
    ], { allKeys: true });
    await collectionsService.addItems(collectionId, [ids[0], ids[1]]);
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><MemoryRouter initialEntries={[`/library/collections/${collectionId}`]}><Routes><Route path="/library/collections/:id" element={<CollectionPage />} /></Routes></MemoryRouter></I18nContext.Provider>);
    await waitFor(() => expect(screen.getByRole("link", { name: "Z theory" })).toBeInTheDocument());
    expect(screen.getAllByRole("link").filter(link => /theory|study/.test(link.textContent ?? "")).map(link => link.textContent)).toEqual(["Z theory", "A study"]);
    const row = within(screen.getByRole("link", { name: "Z theory" }).closest("li")!);
    expect(row.queryByRole("button", { name: `${t("common.edit")} Z theory` })).not.toBeInTheDocument();
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
