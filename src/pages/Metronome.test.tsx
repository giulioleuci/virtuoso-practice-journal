import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nContext, translate } from "@/lib/i18n";
import Metronome from "./Metronome";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); localStorage.clear(); });
const show = () => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><Metronome /></I18nContext.Provider>);

it("steps and clamps the tempo and remembers it", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: t("practice.bpmIncrease", { step: 5 }) }));
  expect(screen.getByText("85", { selector: "p" })).toBeInTheDocument();
  expect(localStorage.getItem("metronome.bpm")).toBe("85");
  for (let i = 0; i < 100; i++) fireEvent.click(screen.getByRole("button", { name: t("practice.bpmDecrease", { step: 5 }) }));
  expect(screen.getByText("1", { selector: "p" })).toBeInTheDocument();
});
