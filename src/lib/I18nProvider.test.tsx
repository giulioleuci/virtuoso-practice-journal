import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { browserLang } from "./i18n";
import { I18nProvider } from "./I18nProvider";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("tells the browser the page language, so native date fields and screen readers follow it", () => {
  render(<I18nProvider initial="de"><p /></I18nProvider>);
  expect(document.documentElement.lang).toBe("de");
});

it("starts from the browser language when it is supported", () => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("it-IT");
  expect(browserLang()).toBe("it");
  vi.spyOn(navigator, "language", "get").mockReturnValue("pt-BR");
  expect(browserLang()).toBe("en");
});
