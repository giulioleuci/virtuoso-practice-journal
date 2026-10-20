import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { I18nContext, translate } from "@/lib/i18n";
import type { Profile } from "@/domain/entities/profile";

const state = vi.hoisted(() => ({ assignments: [] as { taskIds: number[]; ignored?: boolean }[] }));
vi.mock("@/presentation/hooks/useEntities", () => ({ useAssignments: () => state.assignments, useActiveTasks: () => [{ id: 3 }] }));
vi.mock("@/hooks/useAndroidBackButton", () => ({ useAndroidBackButton: () => {} }));
vi.mock("@/hooks/useKeyboardInset", () => ({ useKeyboardInset: () => 0 }));

afterEach(() => { cleanup(); state.assignments = []; });
const t = (key: string, vars?: Record<string, string | number>) => translate("it", key, vars);

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
  expect(screen.getByRole("main")).toHaveFocus();
  expect(nav.queryByRole("link", { name: "Progressi" })).not.toBeInTheDocument();
  fireEvent.click(nav.getByRole("button", { name: "Altro" }));
  const menu = within(screen.getByRole("dialog"));
  expect(menu.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/analytics", "/study-setup", "/print/weekly", "/profile"]);
  fireEvent.click(menu.getByRole("link", { name: "Progressi" }));
  expect(screen.getByRole("main")).toHaveFocus();
  expect(document.title).toContain("Progressi");
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

it("takes the hidden bottom navigation out of the tab order", () => {
  show();
  const nav = screen.getAllByRole("navigation", { name: t("nav.main"), hidden: true })[1];
  expect(nav).not.toHaveAttribute("inert");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
  fireEvent.scroll(window);
  expect(nav).toHaveAttribute("inert");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

it("shows pending homework on the phone Lessons tab and names the count", () => {
  state.assignments = [{ taskIds: [] }, { taskIds: [] }, { taskIds: [3] }];
  const nav = show();
  const label = translate("it", "diary.homework_plural").replace("{{count}}", "2");
  expect(nav.getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", "/lessons");
  expect(screen.getAllByRole("navigation", { name: t("nav.main") })[0].querySelector('a[href="/lessons"]')).toHaveAccessibleName(new RegExp(label));
});

it("keeps Today active while logging a session", () => {
  const nav = show("/log");
  expect(nav.getByRole("link", { name: "Oggi" })).toHaveAttribute("aria-current", "page");
});

it("marks the current secondary destination in the sidebar", () => {
  show("/print/weekly");
  const sidebar = within(screen.getAllByRole("navigation", { name: t("nav.main") })[0].parentElement!);
  expect(sidebar.getByRole("link", { name: t("nav.weeklySummary") })).toHaveAttribute("aria-current", "page");
  expect(sidebar.getAllByRole("link", { name: /Giulio|Impostazioni/ })).toHaveLength(1);
});

it("keeps the bottom navigation out of the way while logging, so the save bar stays put", () => {
  show("/log");
  expect(screen.getAllByRole("navigation", { name: t("nav.main"), hidden: true })[1]).toHaveAttribute("inert");
});
