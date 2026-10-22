import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import { MultiChipPicker } from "./MultiChipPicker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

afterEach(cleanup);
const options = [{ value: "legato", label: "Legato" }, { value: "pedal", label: "Pedal" }];

it.each(["options", "selection"])("allows touch scrolling the %s popover inside the library sheet", async (view) => {
  render(<I18nProvider><Sheet open><SheetContent side="bottom" aria-describedby={undefined}>
    <SheetTitle>Library item</SheetTitle>
    <MultiChipPicker label="Techniques" options={options} value={["legato", "pedal"]} onChange={() => {}} selectionSummary />
  </SheetContent></Sheet></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: view === "options" ? "Techniques" : /Techniques:/ }));
  const list = screen.getByRole("list");
  const viewport = list.closest<HTMLElement>(".overflow-y-auto")!;
  // JSDOM has no layout; give the real scroll lock a scrollable viewport.
  viewport.style.overflowY = "auto";
  Object.defineProperties(viewport, { clientHeight: { value: 100 }, scrollHeight: { value: 300 } });
  viewport.scrollTop = 100;
  await waitFor(() => expect(document.body).toHaveAttribute("data-scroll-locked"));
  for (const clientY of [50, 150]) {
    fireEvent.touchStart(list, { touches: [{ clientX: 0, clientY: 100 }], changedTouches: [{ clientX: 0, clientY: 100 }] });
    expect(fireEvent.touchMove(list, { touches: [{ clientX: 0, clientY }], changedTouches: [{ clientX: 0, clientY }] })).toBe(true);
  }
  fireEvent.keyDown(list, { key: "Escape" });
  await waitFor(() => expect(screen.getByRole("button", { name: view === "options" ? "Techniques" : /Techniques:/ })).toHaveFocus());
});

it("keeps every control a 44px target and removes a chip with one tap", () => {
  const change = vi.fn();
  render(<I18nProvider><MultiChipPicker label="Layers" options={options} value={["legato"]} onChange={change} /></I18nProvider>);
  const trigger = screen.getByRole("button", { name: "Layers" });
  expect(trigger).toHaveClass("min-h-11");
  const chip = screen.getByRole("button", { name: /Legato/ });
  expect(chip).toHaveClass("min-h-11");
  fireEvent.click(chip);
  expect(change).toHaveBeenCalledWith([]);
  fireEvent.click(trigger);
  for (const option of screen.getAllByRole("checkbox")) expect(option).toHaveClass("min-h-11");
});
