import { useEffect, useRef, useState } from "react";
import { THEORY_LAYERS } from "@/domain/constants/theoryLayers";
import type { Subject, SegmentEntry } from "@/domain/entities/common";
import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { TaskLinkType } from "@/domain/entities/task";
import { entryFor, syncPlan } from "@/domain/logic/plan";

/** Plan state of the task forms: one entry per selected section, re-synced when the link selection changes. */
export function useTaskPlan(initial: SegmentEntry[], link: { linkType: TaskLinkType; itemId?: number; segmentIds: number[] }, item?: LibraryItem | null, sections?: Segment[], subject?: Subject) {
  const [plan, setPlan] = useState<SegmentEntry[]>(initial);
  const lastLink = useRef(`${link.linkType}:${link.itemId}`);
  const key = `${link.linkType}:${link.itemId}`;
  const selected = link.segmentIds.flatMap((id) => sections?.find((s) => s.id === id) ?? []);
  const loading = link.linkType === "item" && (!item || (link.segmentIds.length > 0 && selected.length < link.segmentIds.length));

  useEffect(() => {
    if (loading) return;
    const sameLink = lastLink.current === key;
    lastLink.current = key;
    setPlan((prev) => {
      const base = sameLink ? prev : [];
      const next = syncPlan(base, selected, link.linkType === "item" ? item ?? undefined : undefined)
        .map((e) => (subject?.type === "theory" && !e.layers.length && !entryFor(base, e.segmentId) ? { ...e, layers: [...THEORY_LAYERS] } : e));
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, key, link.segmentIds.join(","), item, sections, subject?.type]);

  return [plan, setPlan] as const;
}
