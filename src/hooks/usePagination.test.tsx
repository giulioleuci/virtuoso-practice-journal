import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "./usePagination";

describe("usePagination", () => {
  it("slices items by page", () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(items, 5));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(0);
    expect(result.current.pageItems).toEqual([0, 1, 2, 3, 4]);
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toEqual([10, 11]);
  });

  it("clamps page to the valid range when items shrink", () => {
    const { result, rerender } = renderHook(({ items }) => usePagination(items, 5), {
      initialProps: { items: Array.from({ length: 12 }, (_, i) => i) },
    });
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    rerender({ items: [0, 1, 2] }); // now 1 page
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(0);
    expect(result.current.pageItems).toEqual([0, 1, 2]);
  });

  it("reset returns to the first page", () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(items, 5));
    act(() => result.current.setPage(2));
    act(() => result.current.reset());
    expect(result.current.page).toBe(0);
  });

  it("handles an empty list", () => {
    const { result } = renderHook(() => usePagination([] as number[], 5));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual([]);
  });
});
