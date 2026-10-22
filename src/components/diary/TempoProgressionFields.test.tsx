import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { TempoProgressionRule } from "@/domain/entities/tempoProgression";
import { I18nContext, translate } from "@/lib/i18n";
import { TempoProgressionFields } from "./TempoProgressionFields";
afterEach(cleanup);
it("keeps optional M absent, validates drafts and preserves the last valid disabled rule", () => {
  let saved: TempoProgressionRule | undefined;
  function Harness() {
    const [value,onChange] = useState<TempoProgressionRule>();
    const [valid,onValidityChange] = useState(true);
    return <><TempoProgressionFields {...{ value,onChange,onValidityChange }} /><button disabled={!valid} onClick={() => { saved=value; }}>Salva</button></>;
  }
  render(<I18nContext.Provider value={{ lang: "it", setLang: () => {}, t: (k,v) => translate("it",k,v) }}><Harness /></I18nContext.Provider>);
  fireEvent.click(screen.getByRole("switch", { name: /progressione del tempo/i }));
  expect(screen.getByLabelText(/finestra di sessioni/i)).toHaveValue(null);
  expect(screen.getByText(/richiede successi consecutivi/i)).toBeVisible();
  fireEvent.click(screen.getByRole("switch", { name: /riduzione facoltativa/i }));
  fireEvent.change(screen.getByLabelText(/tipo di riduzione/i), { target: { value: "percent" } });
  fireEvent.change(screen.getByLabelText(/valore della riduzione/i), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText(/insuccessi consecutivi/i), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(saved?.window).toBeUndefined();
  expect(saved?.decrease).toEqual({ failures: 2, step: { kind: "percent", value: 5 } });
  fireEvent.change(screen.getByLabelText(/finestra di sessioni/i), { target: { value: "1" } });
  expect(screen.getByRole("button", { name: "Salva" })).toBeDisabled();
  fireEvent.click(screen.getByRole("switch", { name: /progressione del tempo/i }));
  expect(screen.getByRole("button", { name: "Salva" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(saved?.enabled).toBe(false);
  expect(saved?.decrease?.step.value).toBe(5);
});
