import type { Draft } from "../entities/common";
import type { LibraryItem, Segment, SegmentInput } from "../entities/library";

export interface LibraryPort {
  list(): Promise<LibraryItem[]>;
  get(id: number): Promise<LibraryItem | undefined>;
  upsert(item: Draft<LibraryItem>, segments?: SegmentInput[], collectionIds?: number[]): Promise<number>;
  remove(id: number): Promise<"soft" | "hard">;
  restore(item: LibraryItem, segments: Segment[]): Promise<number>;
  hasSessions(itemId: number): Promise<boolean>;
  hardDelete(itemId: number): Promise<void>;
}
