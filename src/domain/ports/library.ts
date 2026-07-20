import type { Draft } from "../entities/common";
import type { LibraryItem, Segment } from "../entities/library";

export interface LibraryPort {
  list(): Promise<LibraryItem[]>;
  get(id: number): Promise<LibraryItem | undefined>;
  upsert(item: Draft<LibraryItem>, segments?: Omit<Segment, "id" | "itemId" | "createdAt">[]): Promise<number>;
  remove(id: number): Promise<"soft" | "hard">;
  restore(item: LibraryItem, segments: Segment[]): Promise<number>;
  hasSessions(itemId: number): Promise<boolean>;
  hardDelete(itemId: number): Promise<void>;
}
