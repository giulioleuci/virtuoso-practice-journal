import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { HomeworkInput } from "./HomeworkInput";
import { lessonsService } from "@/lib/services";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("labels its submit as an action, not as a field", () => {
  render(<I18nProvider><HomeworkInput recurrence={{ subjectId: 1 } as LessonRecurrence} date="2026-10-20" /></I18nProvider>);
  expect(screen.getByRole("textbox", { name: "Add homework" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
});

it.each([true, false])("preserves newer typing when a pending save finishes (fails=%s)", async fails => {
  let finish: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const pending = new Promise<number>((resolve, rejectPromise) => { finish = () => resolve(1); reject = rejectPromise; });
  vi.spyOn(lessonsService, "ensureFor").mockResolvedValue(1);
  vi.spyOn(lessonsService, "addAssignment").mockReturnValue(pending);
  render(<I18nProvider><HomeworkInput recurrence={{ subjectId: 1 } as LessonRecurrence} date="2026-10-20" /></I18nProvider>);
  const input = screen.getByRole("textbox", { name: "Add homework" });
  fireEvent.change(input, { target: { value: "First homework" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await act(async () => {});
  fireEvent.change(input, { target: { value: "Second homework" } });
  await act(async () => { if (fails) reject(new Error("Disk unavailable")); else finish(); });
  await waitFor(() => expect(input).toHaveValue("Second homework"));
});
