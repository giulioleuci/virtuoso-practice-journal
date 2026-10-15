import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingScale } from "./RatingScale";

const labels = ["Very low", "Low", "Medium", "High", "Very high"];

function Harness({ required }: { required?: boolean }) {
  const [value, setValue] = useState<number | undefined>();
  return <RatingScale label="Focus" question="How well?" labels={labels} value={value} onChange={setValue} unanswered="Not answered" scaleHint="1 = Very low · 5 = Very high" clearLabel="Clear" required={required} />;
}

describe("RatingScale", () => {
  it("shows stars filled up to the choice, the meaning of the choice and the scale before any choice", () => {
    render(<Harness />);
    expect(screen.getByText("1 = Very low · 5 = Very high")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "4 — High" }));
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByRole("button", { name: "3 — Medium" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "4 — High" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "3 — Medium" }).querySelector("svg")?.getAttribute("class")).toMatch(/fill-current/);
    expect(screen.getByRole("button", { name: "5 — Very high" }).querySelector("svg")?.getAttribute("class")).not.toMatch(/fill-current/);
  });

  it("clears the choice with an explicit button, for optional and required ratings alike, and only when there is a choice", () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole("button", { name: "Clear: Focus" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2 — Low" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear: Focus" }));
    expect(screen.getByRole("button", { name: "2 — Low" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Clear: Focus" })).toBeNull();
    unmount();
    render(<Harness required />);
    fireEvent.click(screen.getByRole("button", { name: "5 — Very high" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear: Focus" }));
    expect(screen.getByText(/Not answered/)).toBeTruthy();
  });

  it("keeps the choice when the same star is pressed again", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "2 — Low" }));
    fireEvent.click(screen.getByRole("button", { name: "2 — Low" }));
    expect(screen.getByRole("button", { name: "2 — Low" }).getAttribute("aria-pressed")).toBe("true");
  });
});
