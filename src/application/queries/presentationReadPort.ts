/**
 * Application-facing read and invalidation boundary for presentation adapters.
 * Infrastructure may use Dexie to implement this port; callers never receive a
 * table, collection, or persistence query object.
 */
export interface PresentationReadPort {
  read<T>(operation: string, parameters?: readonly unknown[]): Promise<T>;
  subscribe(listener: () => void): () => void;
}
