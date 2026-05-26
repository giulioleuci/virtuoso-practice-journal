/** Shared service helpers: soft-delete predicate, timestamps, M2M + cascade. */
import type { Table } from "dexie";
import { db } from "@/lib/db";

export { now } from "@/lib/date";
import { now } from "@/lib/date";

/** True when a row is not soft-deleted. */
export const notDeleted = <T extends { deletedAt?: number }>(x: T): boolean => !x.deletedAt;

/** Stamp a `createdAt` (does not overwrite an existing one). */
export function withCreated<T extends { createdAt?: number }>(x: T): T & { createdAt: number } {
  return { ...x, createdAt: x.createdAt ?? now() };
}

/** Stamp `updatedAt` to the current time. */
export function withUpdated<T>(x: T): T & { updatedAt: number } {
  return { ...x, updatedAt: now() };
}

/**
 * Resolve a many-to-many relationship: from link rows on `linkTable` matching
 * `linkFK === key`, gather target ids and load the corresponding `targetTable`
 * rows (soft-deleted targets excluded).
 */
export async function resolveMany<L, T extends { id?: number; deletedAt?: number }>(
  linkTable: Table<L, number>,
  linkFK: keyof L,
  key: number,
  targetIdField: keyof L,
  targetTable: Table<T, number>,
): Promise<T[]> {
  const links = await linkTable.where(linkFK as string).equals(key).toArray();
  if (!links.length) return [];
  const ids = links.map((l) => l[targetIdField] as unknown as number);
  const rows = await targetTable.where("id").anyOf(ids).toArray();
  return rows.filter(notDeleted);
}

/** Delete a parent row and its FK-linked children in one transaction (hard delete). */
export async function cascadeDelete(
  parentTable: Table<{ id?: number }, number>,
  id: number,
  children: { table: Table<unknown, number>; fk: string }[],
): Promise<void> {
  await db.transaction("rw", [parentTable, ...children.map((c) => c.table)], async () => {
    for (const { table, fk } of children) {
      await table.where(fk).equals(id).delete();
    }
    await parentTable.delete(id);
  });
}
