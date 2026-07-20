import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { useTasksByItem } from "./useEntities";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("presentation task query adapter", () => {
  it("updates item DTOs after its subscription is notified", async () => {
    const { result } = renderHook(() => useTasksByItem(7));
    await waitFor(() => expect(result.current).toEqual([]));

    await db.tasks.add({ subjectId: 1, itemId: 7, title: "Scales", date: "2026-07-20", done: false, createdAt: 1 });
    await waitFor(() => expect(result.current?.map((task) => task.title)).toEqual(["Scales"]));
  });
});
