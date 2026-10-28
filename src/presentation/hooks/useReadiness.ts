import { useMemo } from "react";
import type { LibraryItem } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import { pieceEvidence } from "@/domain/logic/readiness";
import { useLibrary, useSegments, useSessions } from "./useEntities";

/** Readiness lookups for library items: sessions and segments per item, and the readiness breakdown. */
export function useReadiness() {
  const library = useLibrary();
  const sessions = useSessions();
  const segments = useSegments();

  return useMemo(() => {
    const byItem = new Map<number, Session[]>();
    for (const session of sessions ?? []) if (session.itemId !== undefined) byItem.set(session.itemId, [...(byItem.get(session.itemId) ?? []), session]);
    const sessionsOf = (itemId?: number) => (itemId === undefined ? [] : byItem.get(itemId) ?? []);
    const segmentsOf = (itemId?: number) => (segments ?? []).filter((segment) => segment.itemId === itemId);
    return {
      ready: library !== undefined && sessions !== undefined && segments !== undefined,
      itemsById: new Map((library ?? []).map((item) => [item.id, item])),
      sessionsOf,
      segmentsOf,
      evidenceFor: (item: LibraryItem) => pieceEvidence(item, segmentsOf(item.id), sessionsOf(item.id)),
    };
  }, [library, sessions, segments]);
}
