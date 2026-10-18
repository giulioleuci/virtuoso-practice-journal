import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSessionDraft } from "./useSessionDraft";
import { clearSessionDrafts } from "@/lib/sessionDrafts";

const initial = { marks: [{ layers: [], techniques: [] }], notes: "", clips: [], needHelp: false, helpText: "" };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("persists full draft metadata including audio references synchronously and restores it", () => {
  const view = renderHook(() => useSessionDraft("task-1", initial));
  const clip = { uid: "clip-1", mimeType: "audio/webm", durationMs: 1200, title: "Take 1" };
  act(() => view.result.current.update({ notes: "Left hand", clips: [clip], needHelp: true, helpText: "Fingering?" }));
  view.unmount();
  const restored = renderHook(() => useSessionDraft("task-1", initial));
  expect(restored.result.current.draft).toMatchObject({ notes: "Left hand", clips: [clip], needHelp: true, helpText: "Fingering?" });
  act(() => restored.result.current.clear());
  restored.unmount();
  expect(renderHook(() => useSessionDraft("task-1", initial)).result.current.draft.notes).toBe("");
});

it("does not erase previous notes when practice updates only marks and clips", () => {
  const first = renderHook(() => useSessionDraft("task-1", initial));
  act(() => first.result.current.update({ notes: "Keep this", marks: [{ layers: [], techniques: [], confidence: 4 }] }));
  first.unmount();
  const practice = renderHook(() => useSessionDraft("task-1", initial));
  act(() => practice.result.current.update({ marks: [{ layers: [], techniques: [], bpm: 72 }] }));
  expect(practice.result.current.draft.notes).toBe("Keep this");
});

it("keeps entered values and reports failure when browser storage refuses a write", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  const view = renderHook(() => useSessionDraft("free", initial));
  act(() => view.result.current.update({ notes: "Still here" }));
  expect(view.result.current.draft.notes).toBe("Still here");
  expect(view.result.current.storageFailed).toBe(true);
});

it("rejects malformed stored drafts without breaking the form", () => {
  localStorage.setItem("virtuoso-session-free", JSON.stringify({ ...initial, marks: [{ layers: null }] }));
  expect(renderHook(() => useSessionDraft("free", initial)).result.current.draft).toEqual(initial);
});

it("removes only session and legacy marks drafts on an explicit data wipe", () => {
  localStorage.setItem("virtuoso-session-free", "{}");
  localStorage.setItem("virtuoso-marks-1", "[]");
  localStorage.setItem("unrelated", "keep");
  clearSessionDrafts();
  expect(localStorage.getItem("virtuoso-session-free")).toBeNull();
  expect(localStorage.getItem("virtuoso-marks-1")).toBeNull();
  expect(localStorage.getItem("unrelated")).toBe("keep");
});

it("receives a recording that finishes after the previous form unmounted", () => {
  const old = renderHook(() => useSessionDraft("free", initial));
  const finishRecording = old.result.current.update;
  old.unmount();
  const reopened = renderHook(() => useSessionDraft("free", initial));
  act(() => finishRecording({ clips: [{ uid: "late-take", mimeType: "audio/webm", durationMs: 1000 }] }));
  expect(reopened.result.current.draft.clips[0]?.uid).toBe("late-take");
  act(() => reopened.result.current.update({ notes: "Do not lose the take" }));
  reopened.unmount();
  expect(renderHook(() => useSessionDraft("free", initial)).result.current.draft.clips[0]?.uid).toBe("late-take");
});

it("prefers current practice results over older storage while retaining existing notes", () => {
  const first = renderHook(() => useSessionDraft("task-1", initial));
  act(() => first.result.current.update({ notes: "Keep notes", marks: [{ layers: [], techniques: [], confidence: 2 }] }));
  first.unmount();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  const form = renderHook(() => useSessionDraft("task-1", initial, { marks: [{ layers: [], techniques: [], confidence: 4 }], clips: [{ uid: "latest", mimeType: "audio/webm", durationMs: 1000 }] }));
  expect(form.result.current.draft).toMatchObject({ notes: "Keep notes", marks: [{ confidence: 4 }], clips: [{ uid: "latest" }] });
  expect(form.result.current.storageFailed).toBe(true);
});
