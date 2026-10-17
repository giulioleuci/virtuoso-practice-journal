import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nContext, translate } from "@/lib/i18n";
import type { SegmentMark } from "@/domain/entities/common";
import { MarksEditor } from "./MarksEditor";

describe("MarksEditor", () => {
  it("allows musical results in a theory subject while preserving the target figure", () => {
    function Form() {
      const [marks, setMarks] = useState<SegmentMark[]>([{ bpm: 88, noteVal: "quarter", targetBpm: 88, targetNoteVal: "quarter", layers: [], techniques: [] }]);
      return <><MarksEditor marks={marks} onChange={setMarks} isTheory showTempo layerOptions={[]} techniqueOptions={[]} /><output>{JSON.stringify(marks)}</output></>;
    }
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><Form /></I18nContext.Provider>);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "56" } });
    fireEvent.click(screen.getByRole("button", { name: translate("it", "note.eighth") }));
    expect(JSON.parse(screen.getByRole("status").textContent!)[0]).toMatchObject({ bpm: 56, noteVal: "eighth", targetBpm: 88, targetNoteVal: "quarter" });
  });
});
