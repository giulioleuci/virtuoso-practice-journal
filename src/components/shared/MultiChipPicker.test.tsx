import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import { MultiChipPicker } from "./MultiChipPicker";

afterEach(cleanup);
const options = [{ value: "legato", label: "Legato" }, { value: "pedal", label: "Pedal" }];

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
