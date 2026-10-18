import type { Draft } from "../entities/common";
import type { PerformanceEvent, PerformanceItem } from "../entities/performance";

export interface PerformancePort {
  listEvents(): Promise<PerformanceEvent[]>;
  listLinks(): Promise<PerformanceItem[]>;
  upsertEvent(event: Draft<PerformanceEvent>): Promise<number>;
  removeEvent(id: number): Promise<void>;
  setEventItems(eventId: number, itemIds: number[]): Promise<void>;
}

export interface RepertoirePort {
  setInRepertoire(itemId: number, inRepertoire: boolean): Promise<void>;
}
