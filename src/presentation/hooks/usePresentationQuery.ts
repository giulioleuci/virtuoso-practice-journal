import { useCallback, useEffect, useState } from "react";
import type { PresentationQueryService } from "@/application/queries/presentationQueryService";

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
