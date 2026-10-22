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

it("keeps a steady beat on the audio clock while the tempo changes, without a burst of clicks", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const starts: number[] = [];
  const clock = { now: 0 };
  vi.stubGlobal("AudioContext", class {
    state = "running"; destination = {};
    get currentTime() { return clock.now; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => d }; }
    createOscillator() { return { frequency: { value: 0 }, type: "", connect: (g: unknown) => g, start: (when = clock.now) => starts.push(when), stop() {} }; }
  });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={{ id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 }} onClose={() => {}} onFinish={() => {}} /></I18nContext.Provider>);
  const start = await screen.findByRole("button", { name: t("practice.start") });
  // Fake only the scheduler's wake-ups, and only once the page is ready (Testing Library polls with real timers).
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    fireEvent.click(start);
    vi.advanceTimersByTime(25);
    const before = starts.length;
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: t("practice.bpmIncrease", { step: 5 }) }));
    vi.advanceTimersByTime(25);
    expect(starts.length).toBe(before);
    for (let step = 1; step <= 40; step++) { clock.now = step * 0.05; vi.advanceTimersByTime(25); }
    const gaps = starts.slice(before).map((when, i, all) => (i ? when - all[i - 1] : 0)).slice(1);
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap).toBeCloseTo(60 / 110, 3);
  } finally { vi.useRealTimers(); }
}, 10000);

it("swings the pendulum on the scheduled beat and marks every beat, even with one beat per bar", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const clock = { now: 0 };
  vi.stubGlobal("AudioContext", class {
    state = "running"; destination = {};
    get currentTime() { return clock.now; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => d }; }
    createOscillator() { return { frequency: { value: 0 }, type: "", connect: (g: unknown) => g, start() {}, stop() {} }; }
  });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={{ id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 }} onClose={() => {}} onFinish={() => {}} /></I18nContext.Provider>);
  fireEvent.click(await screen.findByRole("button", { name: t("practice.start") }));
  const pendulum = document.querySelector<HTMLElement>("[data-pendulum]")!;
  const beat = () => document.querySelector<HTMLElement>("[data-beat-mark]")!;
  await waitFor(() => expect(beat().dataset.beatMark).toBe("1"));
  const first = { swing: pendulum.style.transform, mark: beat() };
  clock.now = 1.02;
  await waitFor(() => expect(beat().dataset.beatMark).toBe("2"), { timeout: 2000 });
  expect(pendulum.style.transform).not.toBe(first.swing);
  expect(beat()).not.toBe(first.mark);
});

it("schedules 1 BPM sixty seconds apart, applies 1→120 promptly and skips suspended beats", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const starts: number[] = [];
  const clock = { now: 0 };
  vi.stubGlobal("AudioContext", class {
    state = "running"; destination = {};
    get currentTime() { return clock.now; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => d }; }
    createOscillator() { return { frequency: { value: 0 }, type: "", connect: (g: unknown) => g, start: (when: number) => starts.push(when), stop() {} }; }
  });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  localStorage.setItem("virtuoso-session-task-1-1", JSON.stringify({ marks: [{ layers: [], techniques: [], bpm: 1, noteVal: "quarter" }], clips: [], notes: "", needHelp: false, helpText: "" }));
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={{ id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-22", done: false, createdAt: 1 }} onClose={() => {}} onFinish={() => {}} /></I18nContext.Provider>);
  const start = await screen.findByRole("button", { name: t("practice.start") });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    fireEvent.click(start);
    clock.now = 60; vi.advanceTimersByTime(25);
    expect(starts[1] - starts[0]).toBeCloseTo(60);
    const five = screen.getByRole("button",{ name: t("practice.bpmIncrease",{ step: 5 }) });
    const one = screen.getByRole("button",{ name: t("practice.bpmIncrease",{ step: 1 }) });
    for (let i = 0; i < 23; i++) fireEvent.click(five);
    for (let i = 0; i < 4; i++) fireEvent.click(one);
    clock.now = 60.5; vi.advanceTimersByTime(25);
    expect(starts.at(-1)).toBeCloseTo(60.55);
    const before = starts.length;
    clock.now = 3600; vi.advanceTimersByTime(25);
    expect(starts.length - before).toBeLessThanOrEqual(1);
    expect(starts.at(-1)).toBeGreaterThanOrEqual(clock.now);
  } finally { vi.useRealTimers(); }
}, 20000);
