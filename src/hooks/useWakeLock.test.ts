import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

describe("useWakeLock", () => {
  it("takes a new lock when the page returns after the browser released it", async () => {
    const sentinels: { released: boolean; release: () => Promise<void> }[] = [];
    const request = vi.fn(async () => {
      const sentinel = { released: false, release: async () => { sentinel.released = true; } };
      sentinels.push(sentinel);
      return sentinel;
    });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    sentinels[0].released = true; // the browser drops the lock while the page is hidden
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});
