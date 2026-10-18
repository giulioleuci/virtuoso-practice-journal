/* eslint-disable no-restricted-imports -- Uses real queries for the modal's context. */
import "fake-indexeddb/auto";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { db } from "@/lib/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { PracticeMode } from "./PracticeMode";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
it("traps keyboard focus, closes with Escape and restores the launching control", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open practice</button>{open && <PracticeMode task={{ id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 }} onClose={() => setOpen(false)} onFinish={() => {}} />}</>;
  }
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><Harness /></I18nContext.Provider>);
  const launch = screen.getByRole("button", { name: "Open practice" });
  launch.focus(); fireEvent.click(launch);
  const dialog = await screen.findByRole("dialog", { name: t("practice.practiceMode") });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  const last = screen.getByRole("button", { name: t("practice.finishLog") });
  last.focus(); fireEvent.keyDown(last, { key: "Tab", code: "Tab" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(last);
  fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(launch).toHaveFocus());
});

it.each([undefined, 99])("seeds missing practice tempo after visiting the log and retains an explicit draft tempo (%s)", async (bpm) => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  await db.sessions.add({ taskId: 1, date: "2026-10-17", marks: [{ layers: [], techniques: [], bpm: 76, noteVal: "eighth", confidence: 4 }], createdAt: 1 });
  localStorage.setItem("virtuoso-session-task-1-1", JSON.stringify({ marks: [{ layers: [], techniques: [], bpm }], clips: [], notes: "", needHelp: false, helpText: "" }));
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={{ id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 }} onClose={() => {}} onFinish={() => {}} /></I18nContext.Provider>);
  expect(await screen.findByText(String(bpm ?? 76))).toBeInTheDocument();
});

it("switches between plain and dotted choices without discarding the selected tempo", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  const finish = vi.fn();
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={{ id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 }} onClose={() => {}} onFinish={finish} /></I18nContext.Provider>);
  const notes = within(screen.getByRole("group", { name: t("practice.noteLabel") }));
  await waitFor(() => expect(notes.getByRole("button", { name: "Quarter note" })).toHaveAttribute("aria-pressed", "true"));
  expect(notes.getByRole("button", { name: "Whole note" })).toBeInTheDocument();
  expect(notes.queryByRole("button", { name: "Dotted quarter note" })).not.toBeInTheDocument();
  const toggle = notes.getByRole("button", { name: "Dotted notes" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(notes.queryByRole("button", { name: "Quarter note" })).not.toBeInTheDocument();
  fireEvent.click(notes.getByRole("button", { name: "Dotted eighth note" }));
  expect(notes.getByRole("button", { name: "Dotted eighth note" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(toggle);
  expect(notes.getByRole("button", { name: "Quarter note" })).toBeInTheDocument();
  expect(notes.queryByRole("button", { name: "Dotted eighth note" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
  expect(finish).toHaveBeenCalledWith(expect.objectContaining({ marks: [expect.objectContaining({ noteVal: "dotted-eighth", bpm: 60 })] }));
});
