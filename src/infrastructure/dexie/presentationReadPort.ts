import { liveQuery } from "dexie";
import type { PresentationReadPort } from "@/application/queries/presentationReadPort";
import { db } from "./db";

const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;

/** Dexie implementation of named presentation read DTO operations. */
export const dexiePresentationReads: PresentationReadPort = {
  async read<T>(operation: string, parameters: readonly unknown[] = []): Promise<T> {
    const [first, second] = parameters;
    switch (operation) {
      case "subjects.active": return db.subjects.filter(active).toArray() as Promise<T>;
      case "techniques.active": return db.techniques.filter(active).toArray() as Promise<T>;
      case "library.active": return db.library.filter(active).toArray() as Promise<T>;
      case "library.repertoire": return db.library.where("kind").equals("repertoire").filter(active).toArray() as Promise<T>;
      case "library.byKind": return (typeof first === "string" ? db.library.where("kind").equals(first).filter(active).toArray() : Promise.resolve([])) as Promise<T>;
      case "library.item": return (typeof first === "number" ? db.library.get(first) : Promise.resolve(undefined)) as Promise<T>;
      case "library.segments": return (typeof first === "number" ? db.segments.where("itemId").equals(first).filter(active).toArray() : Promise.resolve([])) as Promise<T>;
      case "segments.active": return db.segments.filter(active).toArray() as Promise<T>;
      case "tasks.active": return db.tasks.filter(active).toArray() as Promise<T>;
      case "tasks.all": return db.tasks.toArray() as Promise<T>;
      case "tasks.item": return (typeof first === "number" ? db.tasks.where("itemId").equals(first).toArray() : Promise.resolve([])) as Promise<T>;
      case "tasks.date": return (typeof first === "string" ? db.tasks.where("date").equals(first).filter(active).toArray() : Promise.resolve([])) as Promise<T>;
      case "tasks.range": return (typeof first === "string" && typeof second === "string" ? db.tasks.where("date").between(first, second, true, true).filter(active).toArray() : Promise.resolve([])) as Promise<T>;
      case "tasks.one": return (typeof first === "number" ? db.tasks.get(first).then((task) => task ?? null) : Promise.resolve(null)) as Promise<T>;
      case "sessions.all": return db.sessions.toArray() as Promise<T>;
      case "profile.current": return db.profile.get("me") as Promise<T>;
      case "routines.active": return db.studyRoutines.filter(active).toArray() as Promise<T>;
      case "recurrences.active": return db.recurrences.filter(active).toArray() as Promise<T>;
      case "lessons.all": return db.lessons.orderBy("date").reverse().toArray() as Promise<T>;
      case "assignments.all": return db.assignments.toArray() as Promise<T>;
      case "helpRequests.all": return db.helpRequests.toArray() as Promise<T>;
      case "collections.active": return db.collections.filter((row) => active(row) && (!first || row.kind === first)).toArray() as Promise<T>;
      case "collections.all": return db.collections.toArray() as Promise<T>;
      case "collections.items": return (typeof first === "number" ? db.collectionItems.where("collectionId").equals(first).toArray() : Promise.resolve([])) as Promise<T>;
      case "collectionLinks.all": return db.collectionItems.toArray() as Promise<T>;
      default: throw new Error(`Unknown presentation read operation: ${operation}`);
    }
  },
  subscribe(listener) {
    const subscription = liveQuery(() => Promise.all(db.tables.map((table) => table.toArray()))).subscribe({ next: listener });
    return () => subscription.unsubscribe();
  },
};
