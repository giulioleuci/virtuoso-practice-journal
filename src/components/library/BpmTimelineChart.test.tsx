import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext, translate } from "@/lib/i18n";
import { BpmTimelineChart } from "./BpmTimelineChart";

afterEach(() => vi.unstubAllGlobals());

describe("BpmTimelineChart", () => {
  it("keeps both figures visible when one session has differently measured sections", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><BpmTimelineChart sessions={[
      { id: 1, date: "2026-10-01", createdAt: 1, marks: [{ segmentId: 1, bpm: 88, noteVal: "quarter", layers: [], techniques: [] }, { segmentId: 2, bpm: 56, noteVal: "eighth", layers: [], techniques: [] }] },
    ]} /></I18nContext.Provider>);
    expect(screen.getAllByText("♩ = 88").length).toBeGreaterThan(0);
    expect(screen.getAllByText("♪ = 56").length).toBeGreaterThan(0);
  });
  it("shows different figures separately without a misleading tempo delta or target percentage", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><BpmTimelineChart targetBpm={88} targetNoteVal="quarter" sessions={[
      { id: 1, date: "2026-10-01", createdAt: 1, marks: [{ bpm: 88, noteVal: "quarter", layers: [], techniques: [] }] },
      { id: 2, date: "2026-10-02", createdAt: 2, marks: [{ bpm: 56, noteVal: "eighth", layers: [], techniques: [] }] },
    ]} /></I18nContext.Provider>);
    expect(screen.queryByText(/-32|64%/)).not.toBeInTheDocument();
    expect(screen.getAllByText("♩ = 88").length).toBeGreaterThan(0);
    expect(screen.getAllByText("♪ = 56").length).toBeGreaterThan(0);
  });
});
