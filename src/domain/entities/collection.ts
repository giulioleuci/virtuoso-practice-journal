import type { ColorKey, LibraryKind } from "./common";

export interface Collection {
  id?: number;
  kind: LibraryKind;
  name: string;
  composer?: string;
  catalog?: string;
  notes?: string;
  color?: ColorKey;
  defaultSubjectId?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface CollectionItem {
  id: number;
  collectionId: number;
  itemId: number;
  position?: number;
  createdAt: number;
}
