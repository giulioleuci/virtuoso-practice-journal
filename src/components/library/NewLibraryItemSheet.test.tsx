/* eslint-disable no-restricted-imports -- Integration test exercises persistence through the real UI. */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext, translate } from "@/lib/i18n";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { NewLibraryItemSheet } from "./NewLibraryItemSheet";

const t = (key: string) => translate("it", key);
beforeEach(async () => { vi.restoreAllMocks(); await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads); });

describe("NewLibraryItemSheet", () => {
  it("keeps unsaved segment edits when live data refreshes", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const id = await db.library.add({ subjectId, kind: "piece", title: "Prelude", createdAt: 1 });
    const segmentId = await db.segments.add({ itemId: id, label: "A", position: 0, layers: [], barStart: 1, barEnd: 8, createdAt: 1 });
    const item = (await db.library.get(id))!;
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><NewLibraryItemSheet open onOpenChange={() => {}} item={item} kind="piece" /></I18nContext.Provider>);
    await screen.findByText("A", { selector: "summary" });
    fireEvent.click(screen.getByText("A", { selector: "summary" }));
    fireEvent.change(screen.getByLabelText(t("segments.barEnd")), { target: { value: "12" } });
    await act(async () => { await db.segments.update(segmentId, { notes: "Updated in another view" }); await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(screen.getByLabelText(t("segments.barEnd"))).toHaveValue(12);
  });

  it("retains the filled form on failed save, then saves stable segments and repertoire fields", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const id = await db.library.add({ subjectId, kind: "study", title: "Studio n. 1", inRepertoire: true, isFavorite: true, createdAt: 1 });
    const segmentId = await db.segments.add({ itemId: id, label: "A", position: 0, layers: [], barStart: 1, barEnd: 8, createdAt: 1 });
    const item = (await db.library.get(id))!;
    const onClose = vi.fn();
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><NewLibraryItemSheet open onOpenChange={onClose} item={item} kind="study" /></I18nContext.Provider>);
    await waitFor(() => expect(screen.getByText("A", { selector: "summary" })).toBeInTheDocument());
    fireEvent.click(screen.getByText("A", { selector: "summary" }));
    expect(screen.getByLabelText(t("segments.barStart"))).toHaveValue(1);
    fireEvent.change(screen.getByLabelText(t("common.title")), { target: { value: "Studio n. 1 rivisto" } });
    const write = vi.spyOn(db.library, "put").mockRejectedValueOnce(new Error("Disk unavailable"));
    fireEvent.click(screen.getByRole("button", { name: t("collections.saveChanges") }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByLabelText(t("common.title"))).toHaveValue("Studio n. 1 rivisto");
    expect(screen.getByLabelText(t("segments.barEnd"))).toHaveValue(8);
    expect(onClose).not.toHaveBeenCalled();
    write.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: t("collections.saveChanges") }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(await db.library.get(id)).toMatchObject({ title: "Studio n. 1 rivisto", inRepertoire: true, isFavorite: true });
    expect(await db.segments.get(segmentId)).toMatchObject({ id: segmentId, barStart: 1, barEnd: 8 });
  });
});
