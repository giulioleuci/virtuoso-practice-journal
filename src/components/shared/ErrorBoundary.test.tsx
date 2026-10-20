import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import { translate } from "@/lib/i18n";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(cleanup);
function Boom(): never { throw new Error("boom"); }

it("speaks the app language inside the app, not the browser's", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<I18nProvider initial="it"><ErrorBoundary inline><Boom /></ErrorBoundary></I18nProvider>);
  expect(screen.getByRole("heading", { name: translate("it", "states.errorTitle") })).toBeInTheDocument();
});
