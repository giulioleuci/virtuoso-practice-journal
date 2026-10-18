/* eslint-disable no-restricted-imports -- Integration test exercises persistence through the real UI. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/db";
import { I18nContext, translate } from "@/lib/i18n";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { subjectsService } from "@/lib/services/subjects";
import StudySetup from "./StudySetup";

const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);
let pianoId: number;
let theoryId: number;
beforeEach(async () => {
  await db.delete();
  await db.open();
  configurePresentationQueries(dexiePresentationReads);
  pianoId = await db.subjects.add({
    name: "Pianoforte",
    type: "instrument",
    layers: ["DS", "Entrambe"],
    createdAt: 1,
  });
  theoryId = await db.subjects.add({
    name: "Armonia",
    type: "theory",
    createdAt: 1,
  });
  await db.techniques.add({ subjectId: pianoId, name: "Legato", createdAt: 1 });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function show(path = "/study-setup") {
  return render(
    <I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/study-setup/:id?" element={<StudySetup />} />
        </Routes>
      </MemoryRouter>
    </I18nContext.Provider>
  );
}

describe("study subjects", () => {
  it("opens one subject, reveals only the requested editor and returns to the list", async () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(420);
    show();
    fireEvent.click(await screen.findByRole("link", { name: /Pianoforte/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Pianoforte" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Armonia/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("subjects.addTechnique") })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("subjects.techniques")) }));
    fireEvent.click(screen.getByRole("button", { name: t("subjects.addTechnique") }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Staccato" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("common.add") }));
    await screen.findByRole("button", { name: "Staccato" });
    expect(await db.techniques.where("subjectId").equals(pianoId).count()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: t("nav.studySetup") }));
    expect(await screen.findByRole("link", { name: /Armonia/ })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 420);
  });

  it("edits a technique inline, keeps its identity and retains the draft on write failure", async () => {
    show(`/study-setup/${pianoId}`);
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(t("subjects.techniques")),
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Legato" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Legato morbido" },
    });
    const write = vi.spyOn(subjectsService, "renameTechnique").mockRejectedValueOnce(new Error("disk full"));
    fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.couldNotSave"));
    expect(screen.getByRole("textbox")).toHaveValue("Legato morbido");
    write.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: t("common.save") }));
    await screen.findByRole("button", { name: "Legato morbido" });
    expect(await db.techniques.toArray()).toMatchObject([{ subjectId: pianoId, name: "Legato morbido" }]);
  });

  it("creates a subject and rejects a duplicate name without leaving the editor", async () => {
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: t("onb.subjects.addInstrument"),
      })
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " pianoforte " },
    });
    fireEvent.click(screen.getByRole("button", { name: t("common.add") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.subjectExists"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Violino" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("common.add") }));
    expect(await screen.findByRole("heading", { name: "Violino", level: 1 })).toBeInTheDocument();
    expect(await db.subjects.where("name").equals("Violino").first()).toMatchObject({
      type: "instrument",
      layers: [],
    });
  });

  it("keeps theoretical levels read-only and handles an unknown subject", async () => {
    const view = show(`/study-setup/${theoryId}`);
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(t("subjects.layers")),
      })
    );
    expect(screen.getByText(t("subjects.theoryLayersFixed"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("subjects.addLayer") })).not.toBeInTheDocument();
    view.unmount();
    show("/study-setup/99999");
    expect(await screen.findByText(t("subjects.notFound"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("nav.studySetup") }));
    expect(await screen.findByRole("link", { name: /Pianoforte/ })).toBeInTheDocument();
  });

  it("requires confirmation before deleting a subject and returns to the list", async () => {
    show(`/study-setup/${pianoId}`);
    fireEvent.keyDown(await screen.findByRole("button", { name: t("subjects.actions") }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: t("subjects.deleteSubject") }));
    const dialog = await screen.findByRole("alertdialog");
    expect(await db.subjects.get(pianoId)).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.delete") }));
    await waitFor(async () => expect(await db.subjects.get(pianoId)).toBeUndefined());
    expect(await screen.findByRole("link", { name: /Armonia/ })).toBeInTheDocument();
    expect(await db.techniques.count()).toBe(0);
  });
});
