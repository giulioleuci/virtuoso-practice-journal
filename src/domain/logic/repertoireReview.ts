import type { LibraryKind } from "../entities/common";

export const isPerformable = (kind: LibraryKind): boolean => kind === "piece" || kind === "study";
