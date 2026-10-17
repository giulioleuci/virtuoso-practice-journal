import type { CollectionKind, LibraryKind } from "../entities/common";
import type { Collection, CollectionItem } from "../entities/collection";

export interface CollectionPort {
  list(kind?: CollectionKind): Promise<Collection[]>;
  get(id: number): Promise<Collection | undefined>;
  create(row: Omit<Collection, "id">): Promise<number>;
  items(collectionId: number): Promise<CollectionItem[]>;
  update(id: number, patch: Partial<Collection>): Promise<void>;
  remove(id: number): Promise<void>;
  restore(collection: Collection, links: Omit<CollectionItem, "id" | "createdAt">[]): Promise<void>;
  updateItemLink(collectionId: number, itemId: number, patch: Pick<CollectionItem, "reference" | "pageStart" | "pageEnd">): Promise<void>;
  reorderItems(collectionId: number, itemIds: number[]): Promise<void>;
  listForItem(itemId: number): Promise<Collection[]>;
  listItems(collectionId: number): Promise<import("../entities/library").LibraryItem[]>;
  setItemCollections(itemId: number, collectionIds: number[]): Promise<void>;
  addItems(collectionId: number, itemIds: number[]): Promise<void>;
  removeItems(collectionId: number, itemIds: number[]): Promise<void>;
  countItems(id: number): Promise<number>;
  groupLibraryByCollection(kind?: LibraryKind): Promise<Array<{ collection: Collection | null; items: import("../entities/library").LibraryItem[] }>>;
}
