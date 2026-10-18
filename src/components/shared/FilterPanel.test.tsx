import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { I18nContext, translate } from "@/lib/i18n";
import { FilterPanel } from "./FilterPanel";

afterEach(cleanup);

it("keeps search and removable criteria available while filters are collapsed", () => {
  function Controls() {
    const [search, setSearch] = useState("Bach");
    const [subject, setSubject] = useState(true);
    return <FilterPanel
      search={{ value: search, onChange: setSearch, placeholder: "Cerca materiali" }}
      filters={subject ? [{ key: "subject", label: "Materia: Piano", onRemove: () => setSubject(false) }] : []}
      onReset={() => { setSearch(""); setSubject(false); }}
      resultCount={subject ? 2 : 5}
    ><input aria-label="Autore" /></FilterPanel>;
  }
  render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (key, vars) => translate("it", key, vars) }}><Controls /></I18nContext.Provider>);
  expect(screen.getByRole("searchbox")).toHaveValue("Bach");
  expect(screen.queryByRole("textbox", { name: "Autore" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Materia: Piano/ }));
  expect(screen.getByRole("searchbox")).toHaveValue("Bach");
  fireEvent.click(screen.getByRole("button", { name: translate("it", "filters.clearSearch") }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mozart" } });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("searchbox")).toHaveFocus();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Beethoven" } });
  fireEvent.click(screen.getByRole("button", { name: translate("it", "states.clearFilters") }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.queryByRole("button", { name: /Materia: Piano/ })).not.toBeInTheDocument();
});
