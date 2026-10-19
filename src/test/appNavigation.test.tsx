import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { I18nContext, translate } from "@/lib/i18n";
import type { Profile } from "@/domain/entities/profile";

vi.mock("@/presentation/hooks/useEntities", () => ({ useAssignments: () => [] }));
vi.mock("@/hooks/useAndroidBackButton", () => ({ useAndroidBackButton: () => {} }));
vi.mock("@/hooks/useKeyboardInset", () => ({ useKeyboardInset: () => 0 }));

afterEach(cleanup);
const t = (key: string) => translate("it", key);

function show(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}>
        <AppShell profile={{ name: "Giulio" } as Profile} />
      </I18nContext.Provider>
    </MemoryRouter>,
  );
  return within(screen.getAllByRole("navigation", { name: t("nav.main") })[1]);
}

it("shows five bottom navigation items with Today in the middle", () => {
  const nav = show();
  expect(nav.getAllByRole("link").map(link => link.textContent)).toEqual(["Piano", "Lezioni", "Oggi", "Libreria"]);
  expect(nav.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/tasks", "/lessons", "/", "/library"]);
  expect(nav.getByRole("link", { name: "Oggi" })).toHaveAttribute("aria-current", "page");
  expect(nav.getByRole("button", { name: "Altro" })).toBeInTheDocument();
  expect(nav.queryByRole("link", { name: "Progressi" })).not.toBeInTheDocument();
  fireEvent.click(nav.getByRole("button", { name: "Altro" }));
  const menu = within(screen.getByRole("dialog"));
  expect(menu.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/analytics", "/study-setup", "/print/weekly", "/profile"]);
  fireEvent.click(menu.getByRole("link", { name: "Progressi" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(nav.getByRole("button", { name: "Altro" })).toHaveClass("text-primary");
});

it.each(["/analytics", "/history"])("highlights More and Progress for %s", path => {
  const nav = show(path);
  const more = nav.getByRole("button", { name: "Altro" });
  expect(more).toHaveClass("text-primary");
  fireEvent.click(more);
  expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Progressi" })).toHaveClass("text-primary");
});
