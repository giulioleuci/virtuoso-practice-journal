import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext, translate } from "@/lib/i18n";
import { BpmTimelineChart } from "./BpmTimelineChart";

afterEach(() => vi.unstubAllGlobals());

describe("BpmTimelineChart", () => {
  it("announces the selected observation as the keyboard moves across sessions on the same date", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><BpmTimelineChart sessions={[
      { id: 1, date: "2026-10-01", createdAt: 1, marks: [{ bpm: 60, noteVal: "quarter", layers: [], techniques: [] }] },
      { id: 2, date: "2026-10-01", createdAt: 2, marks: [{ bpm: 72, noteVal: "quarter", layers: [], techniques: [] }] },
    ]} /></I18nContext.Provider>);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("\u{1D15F} = 72"));
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("\u{1D15F} = 60"));
  });

  it("keeps both figures visible when one session has differently measured sections", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><BpmTimelineChart sessions={[
      { id: 1, date: "2026-10-01", createdAt: 1, marks: [{ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] }, { segmentId: 2, bpm: 56, noteVal: "eighth", layers: [], techniques: [] }] },
    ]} /></I18nContext.Provider>);
    expect(screen.getAllByText("\u{1D15F} = 88").length).toBeGreaterThan(0);
    expect(screen.getAllByText("\u{1D160} = 56").length).toBeGreaterThan(0);
  });
  it("shows different figures separately without a misleading tempo delta or target percentage", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><BpmTimelineChart targetBpm={88} targetNoteVal="quarter" sessions={[
      { id: 1, date: "2026-10-01", createdAt: 1, marks: [{ bpm: 88, noteVal: "quarter", layers: [], techniques: [] }] },
      { id: 2, date: "2026-10-02", createdAt: 2, marks: [{ bpm: 56, noteVal: "eighth", layers: [], techniques: [] }] },
    ]} /></I18nContext.Provider>);
    expect(screen.queryByText(/-32|64%/)).not.toBeInTheDocument();
    expect(screen.getAllByText("\u{1D15F} = 88").length).toBeGreaterThan(0);
    expect(screen.getAllByText("\u{1D160} = 56").length).toBeGreaterThan(0);
  });
});

it("plots different figures in declared quarter notes and preserves original values", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  render(<I18nContext.Provider value={{ lang: "it",setLang:()=>{},t:(k,v)=>translate("it",k,v) }}><BpmTimelineChart sessions={[
    { id:1,date:"2026-10-01",createdAt:1,marks:[{ bpm:50,noteVal:"quarter",layers:[],techniques:[] }] },
    { id:2,date:"2026-10-02",createdAt:2,marks:[{ bpm:100,noteVal:"eighth",layers:[],techniques:[] }] },
    { id:3,date:"2026-10-03",createdAt:3,marks:[{ bpm:75,noteVal:"dotted-quarter",layers:[],techniques:[] }] },
  ]} /></I18nContext.Provider>);
  expect(screen.getByText(/Figura di riferimento/)).toHaveTextContent("Semiminima");
  expect(screen.getByText("\u{1D160} = 100")).toBeInTheDocument();
  expect(screen.getAllByText("\u{1D15F}. = 75").length).toBeGreaterThan(0);
  expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext",expect.stringContaining("\u{1D15F}. = 75"));
  expect(screen.getByText(/112.5/)).toBeInTheDocument();
});
