import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nContext, translate } from "@/lib/i18n";
import type { SegmentInput } from "@/domain/entities/library";
import { SegmentsEditor } from "./SegmentsEditor";

const t = (key: string) => translate("it", key);

describe("SegmentsEditor", () => {
  it("edits bars, returns to inherited tempo and reorders without losing identities", () => {
    function Form() {
      const [segments, setSegments] = useState<SegmentInput[]>([{ id: 7, label: "A", position: 0, layers: [] }, { id: 8, label: "B", position: 1, layers: [] }]);
      return <><SegmentsEditor segments={segments} onChange={setSegments} itemTempo={{ targetBpm: 88, noteVal: "quarter" }} /><output>{JSON.stringify(segments)}</output></>;
    }
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}><Form /></I18nContext.Provider>);
    const row = within(screen.getAllByRole("listitem")[0]);
    fireEvent.change(row.getByLabelText(t("segments.barStart")), { target: { value: "1" } });
    fireEvent.change(row.getByLabelText(t("segments.barEnd")), { target: { value: "8" } });
    fireEvent.change(row.getByLabelText(t("segments.tempoSource")), { target: { value: "specific" } });
    fireEvent.change(row.getByLabelText(t("segments.targetLabel")), { target: { value: "56" } });
    expect(JSON.parse(screen.getByRole("status").textContent!)[0]).toMatchObject({ id: 7, barStart: 1, barEnd: 8, targetBpm: 56, noteVal: "quarter" });
    fireEvent.change(row.getByLabelText(t("segments.tempoSource")), { target: { value: "inherited" } });
    fireEvent.click(row.getByRole("button", { name: t("segments.moveDown") }));
    expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual([{ id: 8, label: "B", position: 0, layers: [] }, { id: 7, label: "A", position: 1, layers: [], barStart: 1, barEnd: 8 }]);
    const moved = within(screen.getAllByRole("listitem")[1]);
    fireEvent.change(moved.getByLabelText(t("segments.barEnd")), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toHaveTextContent(t("segments.barRangeError"));
  });
});
