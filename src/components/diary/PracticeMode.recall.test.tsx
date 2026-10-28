/* eslint-disable no-restricted-imports -- Uses real queries: recall depends on the stored sessions and drafts. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { db } from "@/infrastructure/dexie/db";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import { dexiePresentationReads } from "@/infrastructure/dexie/presentationReadPort";
import { I18nContext, translate } from "@/lib/i18n";
import { today } from "@/lib/date";
import { tempoProgressionRepository } from "@/infrastructure/repositories/dexie/tempoProgressionRepository";
import { tempoContextKey } from "@/domain/logic/tempoProgression";
import type { Task } from "@/domain/entities/task";
import { PracticeMode } from "./PracticeMode";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const entry = { layers: [], techniques: [] };
const baseTask: Task = { id: 1, title: "Scales", subjectId: 1, plan: [], date: "2026-10-18", done: false, createdAt: 1 };
const draftKey = "virtuoso-session-task-1-1";
const metronome = () => within(screen.getByRole("region", { name: t("practice.metronome") }));
const tempo = () => metronome().getByText((_, el) => el?.tagName === "P" && /^\S\d+$/u.test(el.textContent ?? "") && el.className.includes("font-numeric")).textContent;

function open(task: Task = baseTask, onFinish: (p: unknown) => void = () => {}) {
  return render(<I18nContext.Provider value={{ lang: "en", setLang: () => {}, t }}><PracticeMode task={task} onClose={() => {}} onFinish={onFinish} /></I18nContext.Provider>);
}

beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  await db.delete(); await db.open(); configurePresentationQueries(dexiePresentationReads);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("practice mode data recall", () => {
  it("starts at 60 quarter notes with no history and no target", async () => {
    open();
    await waitFor(() => expect(tempo()).toMatch(/60$/));
    expect(screen.queryByText(/^Last /)).not.toBeInTheDocument();
  });

  it("starts at half the planned target when nothing was played before", async () => {
    open({ ...baseTask, plan: [{ ...entry, segmentId: 1, bpm: 100, noteVal: "eighth" }] });
    await waitFor(() => expect(tempo()).toMatch(/50$/));
    expect(screen.getByText(/^Target /)).toHaveTextContent("100");
  });

  it("recalls the last session of the task: tempo, note value and the Last label", async () => {
    await db.sessions.add({ taskId: 1, date: "2026-10-17", marks: [{ ...entry, bpm: 76, noteVal: "eighth", confidence: 4 }], createdAt: 1 });
    open();
    await waitFor(() => expect(tempo()).toMatch(/76$/));
    expect(screen.getByText(/^Last /)).toHaveTextContent("76");
    expect(within(screen.getByRole("group", { name: t("practice.noteLabel") })).getByRole("button", { name: "Eighth note" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses the newest earlier session and ignores one logged today", async () => {
    await db.sessions.bulkAdd([
      { taskId: 1, date: "2026-10-10", marks: [{ ...entry, bpm: 50, confidence: 3 }], createdAt: 1 },
      { taskId: 1, date: "2026-10-12", marks: [{ ...entry, bpm: 64, confidence: 3 }], createdAt: 2 },
      { taskId: 1, date: today(), marks: [{ ...entry, bpm: 90, confidence: 3 }], createdAt: 3 },
    ]);
    open();
    await waitFor(() => expect(tempo()).toMatch(/64$/));
  });

  it("recalls from another task on the same library item", async () => {
    await db.sessions.add({ taskId: 99, itemId: 7, date: "2026-10-16", marks: [{ ...entry, bpm: 88, noteVal: "quarter", confidence: 4 }], createdAt: 1 });
    open({ ...baseTask, itemId: 7 });
    await waitFor(() => expect(tempo()).toMatch(/88$/));
  });

  it("recalls each section from its own previous mark", async () => {
    await db.sessions.add({ taskId: 1, date: "2026-10-17", marks: [{ ...entry, segmentId: 1, bpm: 70, confidence: 4 }, { ...entry, segmentId: 2, bpm: 90, noteVal: "eighth", confidence: 4 }], createdAt: 1 });
    await db.segments.bulkAdd([{ id: 1, itemId: 1, label: "Intro", order: 0, createdAt: 1 }, { id: 2, itemId: 1, label: "Coda", order: 1, createdAt: 1 }] as never);
    open({ ...baseTask, plan: [{ ...entry, segmentId: 1 }, { ...entry, segmentId: 2 }] });
    await waitFor(() => expect(tempo()).toMatch(/70$/));
    fireEvent.click(await screen.findByRole("button", { name: "Coda" }));
    await waitFor(() => expect(tempo()).toMatch(/90$/));
    fireEvent.click(screen.getByRole("button", { name: "Intro" }));
    expect(tempo()).toMatch(/70$/);
  });

  it("a section never practiced falls back to half its target", async () => {
    await db.sessions.add({ taskId: 1, date: "2026-10-17", marks: [{ ...entry, segmentId: 1, bpm: 70, confidence: 4 }], createdAt: 1 });
    await db.segments.bulkAdd([{ id: 1, itemId: 1, label: "Intro", order: 0, createdAt: 1 }, { id: 2, itemId: 1, label: "Coda", order: 1, createdAt: 1 }] as never);
    open({ ...baseTask, plan: [{ ...entry, segmentId: 1 }, { ...entry, segmentId: 2, bpm: 120, noteVal: "quarter" }] });
    fireEvent.click(await screen.findByRole("button", { name: "Coda" }));
    await waitFor(() => expect(tempo()).toMatch(/60$/));
  });

  it("recalls a section from an older session when a newer one of the same item covered other sections", async () => {
    await db.sessions.bulkAdd([
      { taskId: 50, itemId: 7, date: "2026-10-10", marks: [{ ...entry, segmentId: 2, bpm: 90, confidence: 4 }], tempoSegmentIds: [2], createdAt: 1 },
      { taskId: 51, itemId: 7, date: "2026-10-12", marks: [{ ...entry, segmentId: 1, bpm: 70, confidence: 4 }], tempoSegmentIds: [1], createdAt: 2 },
    ]);
    open({ ...baseTask, itemId: 7, plan: [{ ...entry, segmentId: 2, bpm: 120, noteVal: "quarter" }] });
    await waitFor(() => expect(tempo()).toMatch(/90$/));
  });

  it("keeps an edited tempo across closing and reopening, and the last session never overwrites it", async () => {
    await db.sessions.add({ taskId: 1, date: "2026-10-17", marks: [{ ...entry, bpm: 76, confidence: 4 }], createdAt: 1 });
    const first = open();
    await waitFor(() => expect(tempo()).toMatch(/76$/));
    fireEvent.click(screen.getByRole("button", { name: t("practice.bpmIncrease", { step: 5 }) }));
    await waitFor(() => expect(tempo()).toMatch(/81$/));
    first.unmount();
    open();
    await waitFor(() => expect(tempo()).toMatch(/81$/));
    expect(screen.getByText(/^Last /)).toHaveTextContent("76");
  });

  it("restores ratings and clips from the draft and hands them to the log on finish", async () => {
    localStorage.setItem(draftKey, JSON.stringify({ marks: [{ ...entry, bpm: 72, noteVal: "quarter", confidence: 5, mood: 4 }], clips: [], notes: "n", needHelp: false, helpText: "" }));
    const finish = vi.fn();
    open(baseTask, finish);
    await waitFor(() => expect(tempo()).toMatch(/72$/));
    fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
    expect(finish).toHaveBeenCalledWith({ marks: [expect.objectContaining({ bpm: 72, noteVal: "quarter", confidence: 5, mood: 4 })], clips: [] });
  });

  it("seeds a restored draft whose tempo was never set, but keeps its ratings", async () => {
    await db.sessions.add({ taskId: 1, date: "2026-10-17", marks: [{ ...entry, bpm: 76, confidence: 4 }], createdAt: 1 });
    localStorage.setItem(draftKey, JSON.stringify({ marks: [{ ...entry, confidence: 2 }], clips: [], notes: "", needHelp: false, helpText: "" }));
    const finish = vi.fn();
    open(baseTask, finish);
    await waitFor(() => expect(tempo()).toMatch(/76$/));
    fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
    expect(finish).toHaveBeenCalledWith({ marks: [expect.objectContaining({ bpm: 76, confidence: 2 })], clips: [] });
  });

  it("leaves the tempo out of the log when the tempo toggle is on, and in the draft otherwise", async () => {
    localStorage.setItem(draftKey, JSON.stringify({ marks: [{ ...entry, bpm: 72, noteVal: "quarter", confidence: 3 }], clips: [], notes: "", needHelp: false, helpText: "" }));
    const finish = vi.fn();
    open(baseTask, finish);
    await waitFor(() => expect(tempo()).toMatch(/72$/));
    const skip = screen.getByRole("button", { name: t("practice.skipTempo") });
    fireEvent.click(skip);
    expect(skip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: t("practice.finishLog") }));
    expect(finish).toHaveBeenCalledWith({ marks: [expect.objectContaining({ bpm: undefined, noteVal: undefined, confidence: 3 })], clips: [] });
    expect(JSON.parse(localStorage.getItem(draftKey)!).marks[0].bpm).toBe(72);
  });

  it("offers no engine suggestion for a task outside a routine or recurrence", async () => {
    open({ ...baseTask, itemId: 7 });
    await waitFor(() => expect(tempo()).toMatch(/60$/));
    expect(screen.queryByRole("button", { name: /^Try / })).not.toBeInTheDocument();
  });

  it("offers the engine suggestion beside the last value, applying it only on tap", async () => {
    await db.library.add({ id: 1, title: "Sonata", subjectId: 1, kind: "piece", createdAt: 1 });
    await db.studyRoutines.add({ id: 1, subjectId: 1, groups: [], matrix: {}, startDate: today(), weeksAhead: 1, repetitionCap: 1, createdAt: 1 });
    await tempoProgressionRepository.configure({ kind: "routine", id: 1 }, { enabled: true, successes: 1, minConfidence: 4, increase: { kind: "percent", value: 10 } }, Date.now());
    const context = { itemId: 1, layers: [], techniques: [] };
    const id = await db.tempoProgressions.add({ owner: { kind: "routine", id: 1 }, context, contextKey: tempoContextKey(context), tempo: { bpm: 80, noteVal: "quarter" }, cycle: 1, startedAt: Date.now(), ruleRevision: 1 } as never);
    await db.sessions.add({ taskId: 5, itemId: 1, date: "2026-10-17", marks: [{ ...entry, bpm: 80, noteVal: "quarter", confidence: 5, progression: { id, cycle: 1, minConfidence: 4 } }], createdAt: 1 });
    await db.tasks.add({ id: 6, title: "Sonata", subjectId: 1, itemId: 1, studyRoutineId: 1, date: today(), plan: [], done: true, createdAt: 1 });
    await db.sessions.add({ taskId: 6, itemId: 1, date: today(), marks: [{ ...entry, bpm: 80, noteVal: "quarter", confidence: 5, targetBpm: 80, targetNoteVal: "quarter", progression: { id, cycle: 1, minConfidence: 4 } }], createdAt: 2 });
    open({ ...baseTask, itemId: 1, studyRoutineId: 1 });
    await waitFor(() => expect(tempo()).toMatch(/80$/));
    expect(screen.getByText(/^Last /)).toHaveTextContent("80");
    const hint = await screen.findByRole("button", { name: /^Try / });
    expect(hint).toHaveTextContent("88");
    expect(tempo()).toMatch(/80$/);
    fireEvent.click(hint);
    expect(tempo()).toMatch(/88$/);
    expect(screen.getByText(/^Last /)).toHaveTextContent("80");
  });
});
