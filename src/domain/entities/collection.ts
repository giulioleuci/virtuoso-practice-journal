import type { ColorKey, CollectionKind } from "./common";

export interface Collection {
  id?: number;
  kind: CollectionKind;
  name: string;
  composer?: string;
  catalog?: string;
  edition?: string;
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
  position: number;
  reference?: string;
  pageStart?: number;
  pageEnd?: number;
  createdAt: number;
}
