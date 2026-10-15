import { useMemo } from "react";
import type { LibraryItem } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import { calculateReadiness } from "@/domain/logic/readiness";
import { today } from "@/lib/date";
import { useAllLibrary, useAllSegments, useSessions } from "./useEntities";

/** Readiness lookups for library items: sessions and segments per item, and the readiness breakdown. */
export function useReadiness() {
  const library = useAllLibrary();
  const sessions = useSessions();
  const segments = useAllSegments();

  return useMemo(() => {
    const todayKey = today();
    const byItem = new Map<number, Session[]>();
    for (const session of sessions ?? []) if (session.itemId !== undefined) byItem.set(session.itemId, [...(byItem.get(session.itemId) ?? []), session]);
    const sessionsOf = (itemId?: number) => (itemId === undefined ? [] : byItem.get(itemId) ?? []);
    const segmentsOf = (itemId?: number) => (segments ?? []).filter((segment) => segment.itemId === itemId);
    return {
      ready: library !== undefined && sessions !== undefined && segments !== undefined,
      itemsById: new Map((library ?? []).map((item) => [item.id, item])),
      sessionsOf,
      segmentsOf,
      readinessFor: (item: LibraryItem) => calculateReadiness(item, segmentsOf(item.id), sessionsOf(item.id), todayKey),
    };
  }, [library, sessions, segments]);
}
