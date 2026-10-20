import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import Onboarding from "./Onboarding";

const services = vi.hoisted(() => ({ profileService: { initialize: vi.fn(() => Promise.resolve()) } }));
vi.mock("@/lib/services", () => services);
vi.mock("@/lib/platform", () => ({ isNative: () => false }));
afterEach(cleanup);

it("finishes on the web after subjects, without a reminder that could never fire", async () => {
  render(<I18nProvider><Onboarding onDone={() => {}} /></I18nProvider>);
  expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Italiano/ })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByRole("textbox", { name: "What should we call you?" }), { target: { value: "Clara" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const piano = screen.getByRole("button", { name: "Piano" });
  fireEvent.click(piano);
  expect(piano).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Begin" }));
  await waitFor(() => expect(services.profileService.initialize).toHaveBeenCalledWith(expect.objectContaining({ name: "Clara", reminderEnabled: false })));
});

it("names the button that removes a custom subject", () => {
  render(<I18nProvider><Onboarding onDone={() => {}} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Clara" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByPlaceholderText("New instrument…"), { target: { value: "Theorbo" } });
  fireEvent.click(screen.getByRole("button", { name: "Add instrument" }));
  fireEvent.click(screen.getByRole("button", { name: /Theorbo/ }));
  expect(screen.queryByText("Theorbo")).not.toBeInTheDocument();
});

it("cannot finish without a subject, since a session needs one", () => {
  render(<I18nProvider><Onboarding onDone={() => {}} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Clara" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("button", { name: "Begin" })).toBeDisabled();
});

it("continues with Enter from the name and moves focus to the next question", () => {
  render(<I18nProvider><Onboarding onDone={() => {}} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const name = screen.getByRole("textbox", { name: "What should we call you?" });
  expect(name).toHaveFocus();
  fireEvent.change(name, { target: { value: "Clara" } });
  fireEvent.submit(name);
  expect(screen.getByRole("heading", { name: "What do you study?" })).toHaveFocus();
});
