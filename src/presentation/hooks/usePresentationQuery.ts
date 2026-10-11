import { useCallback, useEffect, useState } from "react";
import { presentationQueries, type PresentationQueryService } from "@/application/queries/presentationQueryService";

/** In-memory last-known results so revisited pages render instantly (stale-while-revalidate). */
const cache = new WeakMap<PresentationQueryService, Map<string, unknown>>();
function cacheFor(queries: PresentationQueryService) {
  let m = cache.get(queries);
  if (!m) { m = new Map(); cache.set(queries, m); }
  return m;
}

/** React adapter for application query DTOs. It has no persistence dependency. */
export function usePresentationQuery<T>(
  queries: PresentationQueryService,
  operation: string,
  parameters: readonly unknown[] = [],
): T | undefined {
  const parameterKey = JSON.stringify(parameters);
  const cacheKey = `${operation}|${parameterKey}`;
  const [state, setState] = useState<{ key: string; value: T | undefined }>(() => ({
    key: cacheKey,
    value: cacheFor(queries).get(cacheKey) as T | undefined,
  }));
  const load = useCallback(() => {
    void queries.execute<T>(operation, ...parameters).then((value) => {
      cacheFor(queries).set(cacheKey, value);
      setState({ key: cacheKey, value });
    });
  // parameterKey prevents an inline argument array from re-subscribing each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation, parameterKey, queries]);

  useEffect(() => {
    load();
    return queries.subscribe(load);
  }, [load, queries]);

  if (state.key !== cacheKey) return cacheFor(queries).get(cacheKey) as T | undefined;
  return state.value;
}

/** Named presentation read adapter; components never access persistence directly. */
export function usePresentationRead<T>(operation: string, parameters: readonly unknown[] = []): T | undefined {
  return usePresentationQuery<T>(presentationQueries(), operation, parameters);
}

/** Subscribe to a typed application read operation without exposing its persistence key. */
export function usePresentationReader<T>(
  reader: (queries: PresentationQueryService) => Promise<T>,
  dependencies: readonly unknown[] = [],
): T | undefined {
  const queries = presentationQueries();
  const [value, setValue] = useState<T>();
  const dependencyKey = JSON.stringify(dependencies);
  const load = useCallback(() => {
    void reader(queries).then(setValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries, dependencyKey]);

  useEffect(() => {
    load();
    return queries.subscribe(load);
  }, [load, queries]);

  return value;
}
