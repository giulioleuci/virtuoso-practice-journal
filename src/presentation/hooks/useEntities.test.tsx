import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { configurePresentationQueries } from "@/application/queries/presentationQueryService";
import type { PresentationReadPort } from "@/application/queries/presentationReadPort";
import {
  useAllTasks,
  useCollectionItems,
  useItem,
  useLessons,
  useProfile,
  useSegmentsByItem,
  useSessionsInRange,
  useTasksInRange,
} from "./useEntities";

class FakeReads implements PresentationReadPort {
  private listener: (() => void) | undefined;

  constructor(private readonly values: Map<string, unknown>) {}

  read<T>(operation: string): Promise<T> {
    return Promise.resolve(this.values.get(operation) as T);
  }

  assignmentsForLesson() { return Promise.resolve([]); }
  openHelpRequestCount() { return Promise.resolve(0); }

  subscribe(listener: () => void): () => void {
    this.listener = listener;
    return () => { this.listener = undefined; };
  }

  notify(operation: string, value: unknown): void {
    this.values.set(operation, value);
    this.listener?.();
  }
}

describe("presentation entity adapters", () => {
  it("distinguishes a missing item from a pending lookup", async () => {
    configurePresentationQueries(new FakeReads(new Map()));
    const { result } = renderHook(() => useItem(999));
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBeNull());
  });

  it.each([
    ["task range", () => useTasksInRange("2026-07-01", "2026-07-31"), "tasks.range", [{ id: 1 }], [{ id: 2 }]],
    ["library item", () => useItem(7), "library.item", { id: 7, title: "Prelude" }, { id: 7, title: "Fugue" }],
    ["item segment", () => useSegmentsByItem(7), "library.segments", [{ id: 1, label: "A" }], [{ id: 2, label: "B" }]],
    ["collection", () => useCollectionItems(3), "collections.items", [{ id: 1, itemId: 7 }], [{ id: 2, itemId: 8 }]],
    ["history", () => useAllTasks(), "tasks.all", [{ id: 1, title: "Old" }], [{ id: 2, title: "New" }]],
    ["session", () => useSessionsInRange("2026-07-01", "2026-07-31"), "sessions.range", [{ id: 1 }], [{ id: 2 }]],
    ["lesson", () => useLessons(), "lessons.all", [{ id: 1 }], [{ id: 2 }]],
    ["profile", () => useProfile(), "profile.current", { id: "me", name: "Ada" }, { id: "me", name: "Grace" }],
  ])("updates %s DTO after fake subscription notification", async (_label, useEntity, operation, initial, updated) => {
    const reads = new FakeReads(new Map([[operation, initial]]));
    configurePresentationQueries(reads);

    const { result } = renderHook(useEntity as () => unknown);
    await waitFor(() => expect(result.current).toEqual(initial));

    reads.notify(operation, updated);
    await waitFor(() => expect(result.current).toEqual(updated));
  });
});
