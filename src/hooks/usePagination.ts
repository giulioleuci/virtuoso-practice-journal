import { useCallback, useMemo, useState } from "react";

export interface Pagination<T> {
  /** Current 0-based page, clamped to the valid range. */
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  pageItems: T[];
  reset: () => void;
}

/** Paginate an in-memory array. 0-based page index, clamped to bounds. */
export function usePagination<T>(items: T[], size: number): Pagination<T> {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => items.slice(safePage * size, safePage * size + size),
    [items, safePage, size],
  );
  const reset = useCallback(() => setPage(0), []);
  return { page: safePage, setPage, totalPages, pageItems, reset };
}
