/* eslint-disable no-restricted-imports -- Uses real queries for the modal's context. */
import "fake-indexeddb/auto";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { PracticeMode } from "./PracticeMode";
import { today } from "@/lib/date";
import { tempoContextKey } from "@/domain/logic/tempoProgression";
import type { Task } from "@/domain/entities/task";
import { NOTE_GLYPH } from "@/lib/constants";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
it("shows each subtask's last safety and its own BPM suggestion", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const rule = { enabled: true, successes: 1, minConfidence: 4, increase: { kind: "percent" as const, value: 10 }, decrease: { failures: 1, step: { kind: "percent" as const, value: 10 } } };
  await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, startDate: today(), weeksAhead: 1, repetitionCap: 1, createdAt: 1, tempoRule: rule });
  await db.library.add({ id: 1, title: "Sonata", subjectId: 1, kind: "piece", createdAt: 1 });
  await db.segments.bulkAdd([1, 2].map(id => ({ id, itemId: 1, label: `Section ${id}`, position: id, layers: [], createdAt: 1 })));
  const plan = [1, 2].map(segmentId => ({ segmentId, bpm: segmentId === 1 ? 70 : 100, noteVal: "quarter" as const, layers: [], techniques: [], progression: { id: segmentId, cycle: 1, minConfidence: 4 } }));
  const task: Task = { id: 1, title: "Daily Practice", subjectId: 1, itemId: 1, studyRoutineId: 1, date: today(), plan, done: false, createdAt: 1 };
  await db.tasks.add(task);
  await db.tempoProgressions.bulkAdd(plan.map(entry => {
    const context = { itemId: 1, segmentId: entry.segmentId, layers: [], techniques: [] };
    return { id: entry.segmentId, owner: { kind: "routine" as const, id: 1 }, context, contextKey: tempoContextKey(context), tempo: { bpm: entry.bpm, noteVal: entry.noteVal }, cycle: 1, startedAt: 1, ruleRevision: 0 };
  }));
  await db.sessions.add({ taskId: 1, itemId: 1, date: "2000-01-01", marks: plan.map(entry => ({ ...entry, targetBpm: entry.bpm, targetNoteVal: entry.noteVal, confidence: entry.segmentId === 1 ? 5 : 2 })), createdAt: 1 });
  const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  const finish = vi.fn();
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={task} onClose={() => {}} onFinish={finish} /></I18nContext.Provider>);
  const first = t("practice.suggestBpm", { note: NOTE_GLYPH.quarter, bpm: 77 });
  const second = t("practice.suggestBpm", { note: NOTE_GLYPH.quarter, bpm: 90 });
  expect(await screen.findByRole("button", { name: first })).toBeInTheDocument();
  expect(await screen.findByText("Last Safety 5 ★")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: second })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: first }));
  fireEvent.click(screen.getByRole("button", { name: t("practice.nextSection") }));
  expect(await screen.findByRole("button", { name: second })).toBeInTheDocument();
  expect(await screen.findByText("Last Safety 2 ★")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: first })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: second }));
  fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
  expect(finish.mock.calls[0][0].marks.map(({ bpm }: { bpm: number }) => bpm)).toEqual([77, 90]);
  expect((await db.tasks.get(1))!.plan.map(entry => entry.bpm)).toEqual([70, 100]);
}, 15000);

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

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const bareTask: Task = { id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 };
const renderBare = (onFinish = vi.fn()) => render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={bareTask} onClose={() => {}} onFinish={onFinish} /></I18nContext.Provider>);
const level = (name: string) => within(screen.getByRole("group", { name: t("practice.clickLevel") })).getByRole("button", { name });

it("schedules only downbeats at level first and saves level and beats per bar", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const starts: number[] = [], clock = { now: 0 };
  vi.stubGlobal("AudioContext", class {
    state = "running"; destination = {};
    get currentTime() { return clock.now; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => d }; }
    createOscillator() { return { frequency: { value: 0 }, type: "", connect: (g: unknown) => g, start: (when: number) => starts.push(when), stop() {} }; }
  });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const finish = vi.fn(); renderBare(finish);
  const start = await screen.findByRole("button", { name: t("practice.start") });
  fireEvent.click(within(screen.getByRole("group", { name: t("practice.beatsPerBar") })).getByRole("button", { name: "4" }));
  fireEvent.click(level(t("click.first")));
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    fireEvent.click(start);
    for (let step = 0; step < 16; step++) { clock.now = step * 0.5; vi.advanceTimersByTime(25); }
    expect(starts.length).toBe(2);
  } finally { vi.useRealTimers(); }
  fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
  expect(finish.mock.calls[0][0].marks[0]).toMatchObject({ click: "first", beatsPerBar: 4 });
}, 10000);

it("keeps level first with one beat per bar", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const finish = vi.fn(); renderBare(finish);
  await screen.findByRole("button", { name: t("practice.start") });
  fireEvent.click(level(t("click.first")));
  expect(level(t("click.first"))).toHaveAttribute("aria-pressed", "true");
  expect(within(screen.getByRole("group", { name: t("practice.beatsPerBar") })).getByRole("button", { name: "1" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
  expect(finish.mock.calls[0][0].marks[0].click).toBe("first");
  expect(finish.mock.calls[0][0].marks[0].beatsPerBar).toBeUndefined();
});

it("asks to start weaning off at target and applies the level on tap", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const rule = { enabled: true, successes: 1, minConfidence: 4, increase: { kind: "percent" as const, value: 10 } };
  await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, startDate: today(), weeksAhead: 1, repetitionCap: 1, createdAt: 1, tempoRule: rule });
  await db.library.add({ id: 1, title: "Sonata", subjectId: 1, kind: "piece", createdAt: 1, targetBpm: 70, noteVal: "quarter" });
  const entry = { bpm: 70, noteVal: "quarter" as const, layers: [], techniques: [], progression: { id: 1, cycle: 1, minConfidence: 4 } };
  const task: Task = { id: 1, title: "Daily Practice", subjectId: 1, itemId: 1, studyRoutineId: 1, date: today(), plan: [entry], done: false, createdAt: 1 };
  await db.tasks.add(task);
  const context = { itemId: 1, layers: [], techniques: [] };
  await db.tempoProgressions.add({ id: 1, owner: { kind: "routine", id: 1 }, context, contextKey: tempoContextKey(context), tempo: { bpm: 70, noteVal: "quarter" }, cycle: 1, startedAt: 1, ruleRevision: 0 });
  await db.sessions.add({ taskId: 1, itemId: 1, date: "2000-01-01", marks: [{ ...entry, targetBpm: 70, targetNoteVal: "quarter", confidence: 5 }], createdAt: 1 });
  render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={task} onClose={() => {}} onFinish={() => {}} /></I18nContext.Provider>);
  fireEvent.click(await screen.findByRole("button", { name: t("practice.suggestRelease", { level: t("click.first") }) }));
  expect(level(t("click.first"))).toHaveAttribute("aria-pressed", "true");
}, 15000);

it("hides Start at no click but logs the tempo", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
  const finish = vi.fn(); renderBare(finish);
  await screen.findByRole("button", { name: t("practice.start") });
  await screen.findByText("60"); // seeded tempo, once the history has loaded
  fireEvent.click(level(t("click.none")));
  expect(screen.queryByRole("button", { name: t("practice.start") })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
  expect(finish.mock.calls[0][0].marks[0]).toMatchObject({ click: "none", bpm: 60 });
});
