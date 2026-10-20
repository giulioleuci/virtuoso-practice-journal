import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/I18nProvider";
import { Pager } from "./Pager";

afterEach(cleanup);
it("changes page without submitting the surrounding editor", () => {
  const submit = vi.fn(event => event.preventDefault());
  const change = vi.fn();
  render(<I18nProvider><form onSubmit={submit}><Pager page={0} totalPages={2} onChange={change} /></form></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(change).toHaveBeenCalledWith(1);
  expect(submit).not.toHaveBeenCalled();
});

it("names its buttons in the app language with 44px targets", () => {
  render(<I18nProvider initial="it"><Pager page={1} totalPages={3} onChange={() => {}} /></I18nProvider>);
  for (const name of ["Pagina precedente", "Pagina successiva"]) expect(screen.getByRole("button", { name })).toHaveClass("h-11", "w-11");
});
