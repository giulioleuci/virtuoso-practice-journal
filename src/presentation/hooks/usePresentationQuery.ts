import { useCallback, useEffect, useState } from "react";
import { presentationQueries, type PresentationQueryService } from "@/application/queries/presentationQueryService";

/** React adapter for application query DTOs. It has no persistence dependency. */
export function usePresentationQuery<T>(
  queries: PresentationQueryService,
  operation: string,
  parameters: readonly unknown[] = [],
): T | undefined {
  const [value, setValue] = useState<T>();
  const parameterKey = JSON.stringify(parameters);
  const load = useCallback(() => {
    void queries.execute<T>(operation, ...parameters).then(setValue);
  // parameterKey prevents an inline argument array from re-subscribing each render.
  // The values remain captured from the render that produced that key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation, parameterKey, queries]);

  useEffect(() => {
    load();
    return queries.subscribe(load);
  }, [load, queries]);

  return value;
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
  // reader captures only dependencies supplied by the feature hook.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries, dependencyKey]);

  useEffect(() => {
    load();
    return queries.subscribe(load);
  }, [load, queries]);

  return value;
}
