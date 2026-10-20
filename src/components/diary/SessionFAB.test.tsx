import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import { SessionFAB } from "./SessionFAB";

afterEach(cleanup);
it("is named by the text it shows (label in name)", () => {
  render(<MemoryRouter><I18nProvider initial="de"><SessionFAB short /></I18nProvider></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Einheit erfassen" })).toHaveAttribute("href", "/log");
});
