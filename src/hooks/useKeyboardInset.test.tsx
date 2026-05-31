import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardInset } from "./useKeyboardInset";

type VisualViewportMock = {
  height: number;
  offsetTop: number;
  listeners: Record<string, ((e: Event) => void)[]>;
  addEventListener: (ev: string, cb: (e: Event) => void) => void;
  removeEventListener: (ev: string, cb: (e: Event) => void) => void;
  emit: (ev: string) => void;
};

function installViewport(initial: { height: number; offsetTop?: number }): VisualViewportMock {
  const mock: VisualViewportMock = {
    height: initial.height,
    offsetTop: initial.offsetTop ?? 0,
    listeners: {},
    addEventListener(ev, cb) {
      (this.listeners[ev] ||= []).push(cb);
    },
    removeEventListener(ev, cb) {
      this.listeners[ev] = (this.listeners[ev] || []).filter((l) => l !== cb);
    },
    emit(ev) {
      (this.listeners[ev] || []).forEach((cb) => cb(new Event(ev)));
    },
  };
  Object.defineProperty(window, "visualViewport", {
    value: mock,
    configurable: true,
    writable: true,
  });
  return mock;
}

describe("useKeyboardInset", () => {
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
    delete (window as { visualViewport?: unknown }).visualViewport;
    vi.restoreAllMocks();
  });

  it("returns 0 when the visual viewport matches the window", () => {
    installViewport({ height: 800 });
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it("ignores tiny viewport differences (mobile URL bar)", () => {
    installViewport({ height: 730 }); // 70px diff, below threshold
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it("reports the keyboard height when the viewport shrinks significantly", () => {
    const vp = installViewport({ height: 800 });
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);

    act(() => {
      vp.height = 460; // keyboard takes 340px
      vp.emit("resize");
    });
    expect(result.current).toBe(340);
  });

  it("returns 0 again when the keyboard is dismissed", () => {
    const vp = installViewport({ height: 460 });
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(340);

    act(() => {
      vp.height = 800;
      vp.emit("resize");
    });
    expect(result.current).toBe(0);
  });

  it("cleans up listeners on unmount", () => {
    const vp = installViewport({ height: 800 });
    const { unmount } = renderHook(() => useKeyboardInset());
    expect((vp.listeners.resize ?? []).length).toBeGreaterThan(0);
    unmount();
    expect((vp.listeners.resize ?? []).length).toBe(0);
  });

  it("returns 0 when visualViewport is not supported", () => {
    (window as { visualViewport?: unknown }).visualViewport = undefined;
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });
});
