import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nContext, translate } from "@/lib/i18n";
import { FilterPanel } from "@/components/shared/FilterPanel";
import { WeekStrip } from "@/components/diary/WeekStrip";
import { ItemQuestions } from "@/components/library/ItemHelpSheet";
import { TeacherAnswersSheet } from "@/components/library/TeacherAnswersSheet";

const mocks = vi.hoisted(() => ({ answer: vi.fn(), remove: vi.fn(), range: vi.fn(() => []) }));
const request = { id: 1, itemId: 2, question: "Quale diteggiatura?", answer: "1-2-3", resolved: true, createdAt: 1 };
vi.mock("@/presentation/hooks/useEntities", () => ({ useTasksInRange: mocks.range }));
vi.mock("@/presentation/hooks/usePresentationQuery", () => ({
  usePresentationRead: (key: string) => key === "library.item" ? { title: "Studio" } : [request],
}));
vi.mock("@/lib/services", () => ({ helpRequestsService: { answer: mocks.answer, remove: mocks.remove } }));
const t = (key: string) => translate("it", key);
function renderControls(children: ReactNode) {
  return render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t }}>{children}</I18nContext.Provider>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("practice controls", () => {
  it("hides filters initially and keeps selections when collapsed", () => {
    const submit = vi.fn((event) => event.preventDefault());
    function Form() {
      const [query, setQuery] = useState("Bach");
      return <form onSubmit={submit}><FilterPanel active><input aria-label="Ricerca" value={query} onChange={event => setQuery(event.target.value)} /></FilterPanel></form>;
    }
    renderControls(<Form />);
    const toggle = screen.getByRole("button", { name: /Filtri/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mozart" } });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByRole("textbox")).toHaveValue("Mozart");
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows the week and navigates across the year boundary", () => {
    function Calendar() {
      const [date, setDate] = useState("2026-12-31");
      return <WeekStrip date={date} onSelect={setDate} />;
    }
    renderControls(<Calendar />);
    expect(screen.getAllByRole("button")).toHaveLength(9);
    expect(mocks.range).toHaveBeenLastCalledWith("2026-12-28", "2027-01-03");
    fireEvent.click(screen.getByRole("button", { name: t("week.next") }));
    expect(mocks.range).toHaveBeenLastCalledWith("2027-01-04", "2027-01-10");
    fireEvent.click(screen.getByRole("button", { name: t("week.prev") }));
    fireEvent.click(screen.getByRole("button", { name: /venerdì 1 gennaio/ }));
    expect(mocks.range).toHaveBeenLastCalledWith("2026-12-28", "2027-01-03");
  });

  it("prefills and saves an existing answer in the material", async () => {
    renderControls(<ItemQuestions itemId={2} />);
    fireEvent.click(screen.getByRole("button", { name: request.question }));
    fireEvent.click(screen.getByRole("button", { name: t("recap.editAnswer") }));
    const editor = screen.getByDisplayValue(request.answer);
    fireEvent.change(editor, { target: { value: "  3-2-1  " } });
    fireEvent.click(screen.getByRole("button", { name: t("recap.saveAnswer") }));
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith(1, "3-2-1"));
  });

  it("requires confirmation before deleting a question and supports cancel", async () => {
    renderControls(<ItemQuestions itemId={2} />);
    fireEvent.click(screen.getByRole("button", { name: request.question }));
    fireEvent.click(screen.getByRole("button", { name: t("common.delete") }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t("common.delete") }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: t("common.delete") }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(1));
  });

  it("edits answers from the quick reference and rejects empty text", async () => {
    renderControls(<TeacherAnswersSheet open onOpenChange={() => {}} itemId={2} />);
    fireEvent.click(screen.getByRole("button", { name: t("recap.editAnswer") }));
    const editor = screen.getByRole("textbox", { name: t("recap.editAnswer") });
    fireEvent.change(editor, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: t("recap.saveAnswer") })).toBeDisabled();
    fireEvent.change(editor, { target: { value: "  4-3-2  " } });
    fireEvent.click(screen.getByRole("button", { name: t("recap.saveAnswer") }));
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith(1, "4-3-2"));
  });
});
