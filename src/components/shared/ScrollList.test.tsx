import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ScrollList } from "./ScrollList";

afterEach(cleanup);
it("shows arrows only in directions with hidden options", () => {
  const { container } = render(<ScrollList><p>Options</p></ScrollList>);
  const viewport = container.querySelector(".overflow-y-auto")!;
  Object.defineProperties(viewport, { clientHeight: { value: 100 }, scrollHeight: { value: 300 } });
  const above = container.querySelector('[data-scroll-cue="above"]');
  const below = container.querySelector('[data-scroll-cue="below"]');
  fireEvent.scroll(viewport, { target: { scrollTop: 0 } });
  expect(above).toHaveClass("invisible");
  expect(below).not.toHaveClass("invisible");
  fireEvent.scroll(viewport, { target: { scrollTop: 100 } });
  expect(above).not.toHaveClass("invisible");
  expect(below).not.toHaveClass("invisible");
  fireEvent.scroll(viewport, { target: { scrollTop: 200 } });
  expect(above).not.toHaveClass("invisible");
  expect(below).toHaveClass("invisible");
});
