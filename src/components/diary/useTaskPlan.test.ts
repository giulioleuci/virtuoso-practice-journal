import { renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import type { Subject } from "@/domain/entities/common";
import { useTaskPlan } from "./useTaskPlan";

it("uses the new subject's aspects when switching a free task between theory subjects", async () => {
  const history: Subject = { id: 1, name: "History", type: "theory", layers: ["Historical context"], createdAt: 1 };
  const harmony: Subject = { id: 2, name: "Harmony", type: "theory", layers: ["aural"], createdAt: 1 };
  const { result, rerender } = renderHook(({ subject }) => useTaskPlan([], { linkType: "free", segmentIds: [] }, undefined, undefined, subject), { initialProps: { subject: history } });
  await waitFor(() => expect(result.current[0][0]?.layers).toEqual(["Historical context"]));
  rerender({ subject: harmony });
  await waitFor(() => expect(result.current[0][0]?.layers).toEqual(["aural"]));
});

it("preserves an edited plan when its theory subject finishes loading", async () => {
  const initial = [{ layers: [], techniques: [] }];
  const { result, rerender } = renderHook(({ subject }: { subject?: Subject }) => useTaskPlan(initial, { linkType: "free", segmentIds: [] }, undefined, undefined, subject), { initialProps: {} });
  rerender({ subject: { id: 1, name: "Harmony", type: "theory", layers: ["aural"], createdAt: 1 } });
  await waitFor(() => expect(result.current[0]).toEqual([{ layers: [], techniques: [] }]));
});
