import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLiveLesson, readLessonDraft, readLiveLesson, setLiveLesson, writeLessonDraft } from "@/lib/liveLesson";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("live lesson pointer", () => {
  it("set then read returns the path", () => {
    expect(readLiveLesson()).toBeUndefined();
    setLiveLesson("/lessons/live?teacher=1");
    expect(readLiveLesson()).toBe("/lessons/live?teacher=1");
  });

  it("clear removes pointer and drafts", () => {
    setLiveLesson("/lessons/live?teacher=1");
    writeLessonDraft("a", "hello");
    writeLessonDraft("b", "world");
    localStorage.setItem("virtuoso-session-x", "keep");
    clearLiveLesson();
    expect(readLiveLesson()).toBeUndefined();
    expect(readLessonDraft("a")).toBe("");
    expect(readLessonDraft("b")).toBe("");
    expect(localStorage.getItem("virtuoso-session-x")).toBe("keep");
  });

  it("draft round-trips and blank removes the key", () => {
    writeLessonDraft("a", "note");
    expect(readLessonDraft("a")).toBe("note");
    writeLessonDraft("a", "  ");
    expect(readLessonDraft("a")).toBe("");
    expect(Object.keys(localStorage).filter((k) => k.startsWith("virtuoso-lesson-draft-"))).toEqual([]);
  });

  it("writers notify listeners", () => {
    const on = vi.fn();
    window.addEventListener("virtuoso-live-lesson", on);
    setLiveLesson("/lessons/live");
    writeLessonDraft("a", "x");
    clearLiveLesson();
    window.removeEventListener("virtuoso-live-lesson", on);
    expect(on).toHaveBeenCalledTimes(3);
  });

  it("read survives a throwing localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    expect(readLiveLesson()).toBeUndefined();
    expect(readLessonDraft("a")).toBe("");
    expect(() => { setLiveLesson("/lessons/live"); writeLessonDraft("a", "x"); clearLiveLesson(); }).not.toThrow();
  });
});
