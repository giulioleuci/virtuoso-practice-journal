import { fireEvent, render, screen } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders feature copy, icon, and its optional action", () => {
    const action = vi.fn();
    render(<EmptyState icon={BookOpen} title="No lessons" hint="Add one" cta={{ label: "Add lesson", onClick: action }} />);
    expect(screen.getByText("No lessons")).toBeInTheDocument();
    expect(screen.getByText("Add one")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add lesson/i }));
    expect(action).toHaveBeenCalledOnce();
  });
});
