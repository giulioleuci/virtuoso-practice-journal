import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Pager } from "./Pager";

afterEach(cleanup);
it("changes page without submitting the surrounding editor", () => {
  const submit = vi.fn(event => event.preventDefault());
  const change = vi.fn();
  render(<form onSubmit={submit}><Pager page={0} totalPages={2} onChange={change} /></form>);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(change).toHaveBeenCalledWith(1);
  expect(submit).not.toHaveBeenCalled();
});
