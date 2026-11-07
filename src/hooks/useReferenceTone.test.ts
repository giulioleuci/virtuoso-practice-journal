import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReferenceTone } from "./useReferenceTone";

afterEach(() => vi.unstubAllGlobals());

it("plays a sustained 440 Hz A and stops it on toggle and unmount", async () => {
  const oscillators: { frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }[] = [];
  class Context {
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    createOscillator() {
      const oscillator = { frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect: vi.fn() };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      return { gain: { value: 0.18, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn() };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const { result, unmount } = renderHook(() => useReferenceTone());
  await act(async () => { await result.current.toggle(); });
  expect(oscillators[0].frequency.value).toBe(440);
  expect(oscillators[0].start).toHaveBeenCalledOnce();
  expect(result.current.playing).toBe(true);
  await act(async () => { await result.current.toggle(); });
  expect(oscillators[0].stop).toHaveBeenCalledOnce();
  expect(result.current.playing).toBe(false);
  await act(async () => { await result.current.toggle(); });
  unmount();
  expect(oscillators[1].stop).toHaveBeenCalledOnce();
});