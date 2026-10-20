import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { FloatingActions } from "./FloatingActions";

const bar = (navHidden: boolean) => (
  <MemoryRouter>
    <Routes>
      <Route element={<Outlet context={{ navHidden }} />}>
        <Route index element={<FloatingActions><button type="submit">Save</button></FloatingActions>} />
      </Route>
    </Routes>
  </MemoryRouter>
);

describe("FloatingActions", () => {
  it("floats above the bottom navigation and the Android system bar while the navigation shows", () => {
    render(bar(false));
    const el = screen.getByRole("button", { name: "Save" }).parentElement!;
    expect(el.className).toMatch(/fixed/);
    expect(el.style.getPropertyValue("--bar-bottom")).toBe("calc(84px + env(safe-area-inset-bottom))");
  });

  it("drops to the system bar when the navigation hides", () => {
    render(bar(true));
    expect(screen.getByRole("button", { name: "Save" }).parentElement!.style.getPropertyValue("--bar-bottom")).toBe("calc(12px + env(safe-area-inset-bottom))");
  });

  it("renders outside the app shell too, with the navigation assumed visible", () => {
    render(<MemoryRouter><FloatingActions><button>Save</button></FloatingActions></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Save" }).parentElement!.style.getPropertyValue("--bar-bottom")).toContain("84px");
  });
});

it("passes landmark props through, so other bars can reuse its positioning", () => {
  render(<MemoryRouter><FloatingActions role="toolbar" aria-label="Selection"><button>Done</button></FloatingActions></MemoryRouter>);
  expect(screen.getByRole("toolbar", { name: "Selection" })).toContainElement(screen.getByRole("button", { name: "Done" }));
});
