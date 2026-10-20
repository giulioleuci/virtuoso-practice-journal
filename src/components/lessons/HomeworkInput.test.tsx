import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { HomeworkInput } from "./HomeworkInput";

afterEach(cleanup);
it("labels its submit as an action, not as a field", () => {
  render(<I18nProvider><HomeworkInput recurrence={{ subjectId: 1 } as LessonRecurrence} date="2026-10-20" /></I18nProvider>);
  expect(screen.getByRole("textbox", { name: "Add homework" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
});
