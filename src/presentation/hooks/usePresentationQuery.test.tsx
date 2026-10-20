import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { configurePresentationQueries, PresentationQueryService } from "@/application/queries/presentationQueryService";
import type { PresentationReadPort } from "@/application/queries/presentationReadPort";
import { usePresentationQuery, usePresentationReader } from "./usePresentationQuery";

class FakeReads implements PresentationReadPort {
  private listener: (() => void) | undefined;
  constructor(private readonly values: Map<string, unknown>) {}
  read<T>(operation: string): Promise<T> { return Promise.resolve(this.values.get(operation) as T); }
  async assignmentsForLesson() { return []; }
  async openHelpRequestCount() { return 0; }
  subscribe(listener: () => void): () => void { this.listener = listener; return () => { this.listener = undefined; }; }
  notify(updates: Record<string, unknown>): void {
    Object.entries(updates).forEach(([operation, value]) => this.values.set(operation, value));
    this.listener?.();
  }
}

describe("presentation query adapter", () => {
  it("does not show a previous reader result while another item is loading", async () => {
    configurePresentationQueries(new FakeReads(new Map()));
    let finish: (value: string) => void = () => {};
    const { result, rerender } = renderHook(({ id }) => usePresentationReader(() => id === 1 ? Promise.resolve("first") : new Promise<string>(resolve => { finish = resolve; }), [id]), { initialProps: { id: 1 } });
    await waitFor(() => expect(result.current).toBe("first"));
    rerender({ id: 2 });
    expect(result.current).toBeUndefined();
    await act(async () => finish("second"));
    expect(result.current).toBe("second");
  });

  it("updates task date and range DTOs after fake subscription notification", async () => {
    const reads = new FakeReads(new Map([
      ["tasks.date", [{ id: 1, date: "2026-07-20" }]],
      ["tasks.range", [{ id: 1, date: "2026-07-20" }]],
    ]));
    const queries = new PresentationQueryService(reads);
    const { result } = renderHook(() => usePresentationQuery<{ id: number; date: string }[]>(queries, "tasks.date", ["2026-07-20"]));
    await waitFor(() => expect(result.current).toEqual([{ id: 1, date: "2026-07-20" }]));
    reads.notify({ "tasks.date": [{ id: 2, date: "2026-07-20" }], "tasks.range": [{ id: 2, date: "2026-07-20" }] });
    await waitFor(() => expect(result.current).toEqual([{ id: 2, date: "2026-07-20" }]));
  });

  it.each([
    ["tasks.diaryDate", { tasks: [{ id: 1 }], sessionsByTask: {} }, { tasks: [{ id: 2 }], sessionsByTask: { 2: [{ id: 3 }] } }],
    ["library.item", { id: 1, title: "Prelude" }, { id: 1, title: "Fugue" }],
    ["library.segments", [{ id: 1, label: "A" }], [{ id: 1, label: "B" }]],
    ["collections.items", [{ id: 1, itemId: 4 }], [{ id: 2, itemId: 5 }]],
    ["sessions.all", [{ id: 1, date: "2026-07-19" }], [{ id: 2, date: "2026-07-20" }]],
    ["lessons.all", [{ id: 1, date: "2026-07-19" }], [{ id: 2, date: "2026-07-20" }]],
    ["profile.current", { id: "me", name: "Ada" }, { id: "me", name: "Grace" }],
  ])("updates %s DTO after fake notification", async (operation, initial, updated) => {
    const reads = new FakeReads(new Map([[operation, initial]]));
    const queries = new PresentationQueryService(reads);
    const { result } = renderHook(() => usePresentationQuery<unknown>(queries, operation));
    await waitFor(() => expect(result.current).toEqual(initial));
    reads.notify({ [operation]: updated });
    await waitFor(() => expect(result.current).toEqual(updated));
  });
});
