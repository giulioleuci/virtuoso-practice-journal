import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nContext, translate } from "@/lib/i18n";
import type { SegmentInput } from "@/domain/entities/library";
import { SegmentsEditor } from "./SegmentsEditor";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";

const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);

it("keeps segment details collapsed and edits the correct segment across pages", () => {
  function Editor() {
    const [segments, setSegments] = useState<SegmentInput[]>(Array.from({ length: 6 }, (_, position) => ({ id: position + 1, label: `Parte ${position + 1}`, position, layers: [] as string[] })));
    return <SegmentsEditor segments={segments} onChange={setSegments} />;
  }
  render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><Editor /></I18nContext.Provider>);
  expect(screen.getByText("Parte 1").closest("details")).not.toHaveAttribute("open");
  expect(screen.queryByText("Parte 6")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
  fireEvent.click(screen.getByText("Parte 6"));
  fireEvent.change(within(screen.getByText("Parte 6").closest("details")!).getByRole("textbox", { name: t("segments.label") }), { target: { value: "Finale" } });
  fireEvent.click(screen.getByRole("button", { name: "Pagina precedente" }));
  expect(screen.getByText("Parte 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pagina successiva" }));
  expect(screen.getByText("Finale")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `${t("common.delete")}: Finale` }));
  expect(screen.getByText("Parte 1")).toBeInTheDocument();
});

it("shows selections through a read-only counter without removable chips", () => {
  render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><MultiChipPicker label="Tecniche" options={[{ value: 1, label: "Arpeggi" }]} value={[1]} onChange={() => {}} selectionSummary /></I18nContext.Provider>);
  expect(screen.queryByText("Arpeggi")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `Tecniche: ${t("common.selected", { count: 1 })}` }));
  expect(screen.getByText("Arpeggi")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Rimuovi.*Arpeggi/ })).not.toBeInTheDocument();
});

  it("edits bars, returns to inherited tempo and reorders without losing identities", () => {
    function Form() {
      const [segments, setSegments] = useState<SegmentInput[]>([{ id: 7, label: "A", position: 0, layers: [] }, { id: 8, label: "B", position: 1, layers: [] }]);
      return <><SegmentsEditor segments={segments} onChange={setSegments} itemTempo={{ targetBpm: 88, noteVal: "quarter" }} /><output>{JSON.stringify(segments)}</output></>;
    }
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><Form /></I18nContext.Provider>);
    fireEvent.click(screen.getByText("A", { selector: "summary" }));
    const row = within(screen.getAllByRole("listitem")[0]);
    fireEvent.change(row.getByLabelText(t("segments.barStart")), { target: { value: "1" } });
    fireEvent.change(row.getByLabelText(t("segments.barEnd")), { target: { value: "8" } });
    fireEvent.keyDown(row.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("option", { name: t("segments.specific") }), { key: "Enter" });
    fireEvent.change(row.getByLabelText(t("segments.targetLabel")), { target: { value: "56" } });
    expect(JSON.parse(screen.getByRole("status").textContent!)[0]).toMatchObject({ id: 7, barStart: 1, barEnd: 8, targetBpm: 56, noteVal: "quarter" });
    fireEvent.keyDown(row.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("option", { name: t("segments.inherited") }), { key: "Enter" });
    fireEvent.click(row.getByRole("button", { name: t("segments.moveDown") }));
    expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual([{ id: 8, label: "B", position: 0, layers: [] }, { id: 7, label: "A", position: 1, layers: [], barStart: 1, barEnd: 8 }]);
    const moved = within(screen.getAllByRole("listitem")[1]);
    fireEvent.change(moved.getByLabelText(t("segments.barEnd")), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toHaveTextContent(t("segments.barRangeError"));
  });
