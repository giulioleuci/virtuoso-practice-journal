import { useLiveQuery } from "dexie-react-hooks";

/** Infrastructure-owned bridge between Dexie observability and React. */
export function useDexieSubscription<T>(query: () => Promise<T>, dependencies: unknown[]): T | undefined {
  return useLiveQuery(query, dependencies);
}
