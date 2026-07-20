import type { LibraryItem, Segment } from "@/domain/entities/library";
import type { LibraryPort } from "@/domain/ports/library";
export type LibraryItemDto = LibraryItem;
export type SegmentDto = Segment;
export interface LibraryQueries { list(): Promise<LibraryItemDto[]>; segmentsFor(itemId: number): Promise<SegmentDto[]>; }
export const libraryQueries = (library: LibraryPort): Pick<LibraryQueries, "list"> => ({ list: () => library.list() });
