import type { LibraryKind } from "../entities/common";
import type { Collection, CollectionItem } from "../entities/collection";

export interface CollectionPort {
  list(kind?: LibraryKind): Promise<Collection[]>;
  get(id: number): Promise<Collection | undefined>;
  items(collectionId: number): Promise<CollectionItem[]>;
  update(id: number, patch: Partial<Collection>): Promise<void>;
  remove(id: number): Promise<void>;
  restore(collection: Collection, links: Pick<CollectionItem, "collectionId" | "itemId" | "position">[]): Promise<void>;
}
