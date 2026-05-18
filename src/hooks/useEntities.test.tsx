import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import {
  useSubjects,
  useLibrary,
  useRepertoire,
  useSegments,
  useActiveTasks,
  useTasksInRange,
  useTechniques,
  useProfile,
  useCollectionItems,
} from "./useEntities";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("useSubjects", () => {
  it("returns active subjects only", async () => {
    const live = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    await db.subjects.add({ name: "Removed", type: "theory", createdAt: 1, deletedAt: 2 });

    const { result } = renderHook(() => useSubjects());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((s) => s.id)).toEqual([live]);
  });

  it("reacts to inserts", async () => {
    const { result } = renderHook(() => useSubjects());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.length).toBe(0);

    await db.subjects.add({ name: "Cello", type: "instrument", createdAt: 1 });
    await waitFor(() => expect(result.current!.length).toBe(1));
    expect(result.current![0].name).toBe("Cello");
  });
});

describe("useLibrary", () => {
  it("returns active library items only", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const liveId = (await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 1 })) as number;
    await db.library.add({ subjectId, kind: "manual", title: "Trashed", createdAt: 1, deletedAt: 2 });

    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((i) => i.id)).toEqual([liveId]);
  });
});

describe("useRepertoire", () => {
  it("returns only repertoire kind items, filtering deleted", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const repId = (await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 1 })) as number;
    await db.library.add({ subjectId, kind: "manual", title: "Czerny", createdAt: 1 });
    await db.library.add({ subjectId, kind: "repertoire", title: "Deleted", createdAt: 1, deletedAt: 2 });

    const { result } = renderHook(() => useRepertoire());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((i) => i.id)).toEqual([repId]);
  });
});

describe("useSegments", () => {
  it("excludes deleted segments", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const itemId = (await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 1 })) as number;
    const segId = (await db.segments.add({ itemId, label: "I", layers: [], createdAt: 1 })) as number;
    await db.segments.add({ itemId, label: "II", layers: [], createdAt: 1, deletedAt: 2 });

    const { result } = renderHook(() => useSegments());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((s) => s.id)).toEqual([segId]);
  });
});

describe("useActiveTasks", () => {
  it("excludes soft-deleted tasks", async () => {
    const live = (await db.tasks.add({
      subjectId: 1, title: "Practice", date: "2025-01-01", done: false, createdAt: 1,
    })) as number;
    await db.tasks.add({
      subjectId: 1, title: "Old", date: "2024-12-01", done: false, createdAt: 1, deletedAt: 2,
    });

    const { result } = renderHook(() => useActiveTasks());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((t) => t.id)).toEqual([live]);
  });
});

describe("useTasksInRange", () => {
  it("returns an empty array when bounds are missing", async () => {
    const { result } = renderHook(() => useTasksInRange(undefined, "2025-01-31"));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual([]);
  });

  it("returns tasks whose date falls within the inclusive bounds", async () => {
    await db.tasks.add({ subjectId: 1, title: "Before", date: "2024-12-31", done: false, createdAt: 1 });
    const inA = (await db.tasks.add({ subjectId: 1, title: "Start", date: "2025-01-01", done: false, createdAt: 1 })) as number;
    const inB = (await db.tasks.add({ subjectId: 1, title: "Middle", date: "2025-01-15", done: false, createdAt: 1 })) as number;
    const inC = (await db.tasks.add({ subjectId: 1, title: "End", date: "2025-01-31", done: false, createdAt: 1 })) as number;
    await db.tasks.add({ subjectId: 1, title: "After", date: "2025-02-01", done: false, createdAt: 1 });

    const { result } = renderHook(() => useTasksInRange("2025-01-01", "2025-01-31"));
    await waitFor(() => expect((result.current ?? []).length).toBe(3));
    expect(result.current!.map((t) => t.id).sort()).toEqual([inA, inB, inC].sort());
  });

  it("excludes soft-deleted tasks within the range", async () => {
    const live = (await db.tasks.add({ subjectId: 1, title: "Live", date: "2025-01-10", done: false, createdAt: 1 })) as number;
    await db.tasks.add({ subjectId: 1, title: "Trashed", date: "2025-01-12", done: false, createdAt: 1, deletedAt: 2 });

    const { result } = renderHook(() => useTasksInRange("2025-01-01", "2025-01-31"));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((t) => t.id)).toEqual([live]);
  });

  it("re-queries when the bounds change", async () => {
    await db.tasks.add({ subjectId: 1, title: "Jan", date: "2025-01-15", done: false, createdAt: 1 });
    await db.tasks.add({ subjectId: 1, title: "Feb", date: "2025-02-15", done: false, createdAt: 1 });

    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => useTasksInRange(from, to),
      { initialProps: { from: "2025-01-01", to: "2025-01-31" } },
    );
    await waitFor(() => expect((result.current ?? []).length).toBe(1));
    expect(result.current![0].title).toBe("Jan");

    rerender({ from: "2025-02-01", to: "2025-02-28" });
    await waitFor(() => expect(result.current?.[0]?.title).toBe("Feb"));
  });
});

describe("useTechniques", () => {
  it("excludes deleted techniques", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const liveId = (await db.techniques.add({ subjectId, name: "Octaves", createdAt: 1 })) as number;
    await db.techniques.add({ subjectId, name: "Removed", createdAt: 1, deletedAt: 2 });

    const { result } = renderHook(() => useTechniques());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.map((s) => s.id)).toEqual([liveId]);
  });
});

describe("useProfile", () => {
  it("returns the singleton profile row", async () => {
    await db.profile.put({
      id: "me", name: "Wolfgang", lang: "en", reminderTime: "18:00",
      reminderFreq: "daily", reminderDays: [], lateRecoveryDays: 3,
      graceDay: true, groupByPhase: true, onboarded: true, createdAt: 1,
    });

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.name).toBe("Wolfgang");
  });

  it("reacts to profile creation", async () => {
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current === undefined).toBe(true));
    await db.profile.put({
      id: "me", name: "Clara", lang: "en", reminderTime: "18:00",
      reminderFreq: "daily", reminderDays: [], lateRecoveryDays: 3,
      graceDay: true, groupByPhase: true, onboarded: true, createdAt: 1,
    });
    await waitFor(() => expect(result.current?.name).toBe("Clara"));
  });
});

describe("useCollectionItems", () => {
  it("returns nothing when no collectionId is provided", async () => {
    const { result } = renderHook(() => useCollectionItems(undefined));
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual([]);
  });

  it("returns items scoped to a single collection", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const a = (await db.library.add({ subjectId, kind: "repertoire", title: "A", createdAt: 1 })) as number;
    const b = (await db.library.add({ subjectId, kind: "repertoire", title: "B", createdAt: 1 })) as number;
    const collA = (await db.collections.add({ kind: "repertoire", name: "Set 1", createdAt: 1, updatedAt: 1 })) as number;
    const collB = (await db.collections.add({ kind: "repertoire", name: "Set 2", createdAt: 1, updatedAt: 1 })) as number;
    await db.collectionItems.bulkAdd([
      { collectionId: collA, itemId: a, createdAt: 1 },
      { collectionId: collA, itemId: b, createdAt: 1 },
      { collectionId: collB, itemId: a, createdAt: 1 },
    ]);

    const { result } = renderHook(() => useCollectionItems(collA));
    await waitFor(() => expect((result.current ?? []).length).toBe(2));
    expect(result.current!.map((ci) => ci.itemId).sort()).toEqual([a, b].sort());
  });

  it("re-queries when the collectionId changes", async () => {
    const subjectId = (await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 })) as number;
    const a = (await db.library.add({ subjectId, kind: "repertoire", title: "A", createdAt: 1 })) as number;
    const collA = (await db.collections.add({ kind: "repertoire", name: "Set 1", createdAt: 1, updatedAt: 1 })) as number;
    const collB = (await db.collections.add({ kind: "repertoire", name: "Set 2", createdAt: 1, updatedAt: 1 })) as number;
    await db.collectionItems.add({ collectionId: collA, itemId: a, createdAt: 1 });

    const { result, rerender } = renderHook(({ id }: { id?: number }) => useCollectionItems(id), {
      initialProps: { id: collA },
    });
    await waitFor(() => expect((result.current ?? []).length).toBe(1));

    rerender({ id: collB });
    await waitFor(() => expect((result.current ?? []).length).toBe(0));
  });
});
