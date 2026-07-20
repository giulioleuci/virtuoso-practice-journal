import type { Collection, CollectionItem } from "@/domain/entities/collection";
import type { CollectionPort } from "@/domain/ports/collection";
export type CollectionDto = Collection;
export type CollectionItemDto = CollectionItem;
export interface CollectionQueries { list(): Promise<CollectionDto[]>; itemsFor(collectionId: number): Promise<CollectionItemDto[]>; }
export const collectionQueries = (collections: CollectionPort): CollectionQueries => ({ list: () => collections.list(), itemsFor: (id) => collections.items(id) });
