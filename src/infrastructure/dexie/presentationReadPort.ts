import { liveQuery } from "dexie";
import type { PresentationReadPort } from "@/application/queries/presentationReadPort";
import { db } from "./db";

const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;

/** Dexie implementation of named presentation read DTO operations. */
export const dexiePresentationReads: PresentationReadPort = {
  async read<T>(operation: string, parameters: readonly unknown[] = []): Promise<T> {
    const [first, second] = parameters;
    switch (operation) {
      case "subjects.active": return db.subjects.filter(active).toArray() as unknown as Promise<T>;
      case "techniques.active": return db.techniques.filter(active).toArray() as unknown as Promise<T>;
      case "library.active": return db.library.filter(active).toArray() as unknown as Promise<T>;
      case "library.repertoire": return db.library.where("kind").equals("repertoire").filter(active).toArray() as unknown as Promise<T>;
      case "library.byKind": return (typeof first === "string" ? db.library.where("kind").equals(first).filter(active).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "library.item": return (typeof first === "number" ? db.library.get(first) : Promise.resolve(undefined)) as unknown as Promise<T>;
      case "library.segments": return (typeof first === "number" ? db.segments.where("itemId").equals(first).filter(active).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "segments.active": return db.segments.filter(active).toArray() as unknown as Promise<T>;
      case "tasks.active": return db.tasks.filter(active).toArray() as unknown as Promise<T>;
      case "tasks.all": return db.tasks.toArray() as unknown as Promise<T>;
      case "tasks.item": return (typeof first === "number" ? db.tasks.where("itemId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "tasks.date": return (typeof first === "string" ? db.tasks.where("date").equals(first).filter(active).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "tasks.range": return (typeof first === "string" && typeof second === "string" ? db.tasks.where("date").between(first, second, true, true).filter(active).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "tasks.one": return (typeof first === "number" ? db.tasks.get(first).then((task) => task ?? null) : Promise.resolve(null)) as unknown as Promise<T>;
      case "tasks.diaryDate": return (async () => {
        if (typeof first !== "string") return { tasks: [], sessionsByTask: {} };
        const tasks = await db.tasks.where("date").equals(first).filter(active).toArray();
        const ids = tasks.flatMap((task) => task.id === undefined ? [] : [task.id]);
        const sessions = ids.length ? await db.sessions.where("taskId").anyOf(ids).toArray() : [];
        const sessionsByTask = sessions.reduce<Record<number, typeof sessions>>((grouped, session) => {
          (grouped[session.taskId] ??= []).push(session);
          return grouped;
        }, {});
        return { tasks, sessionsByTask };
      })() as unknown as Promise<T>;
      case "tasks.carryover": return (typeof first === "string" && typeof second === "string"
        ? db.tasks.where("date").between(first, second, true, false).filter((task) => active(task) && !task.done && !task.skipped).toArray()
        : Promise.resolve([])) as unknown as Promise<T>;
      case "tasks.ignored": return (typeof first === "string" && typeof second === "string"
        ? db.tasks.where("date").between(first, second, true, false).filter((task) => active(task) && !!task.skipped && !task.done).toArray()
        : Promise.resolve([])) as unknown as Promise<T>;
      case "sessions.all": return db.sessions.toArray() as unknown as Promise<T>;
      case "sessions.range": return (async () => {
        if (typeof first === "string" && typeof second === "string") return db.sessions.where("date").between(first, second, true, true).toArray();
        if (typeof first === "string") return db.sessions.where("date").aboveOrEqual(first).toArray();
        if (typeof second === "string") return db.sessions.where("date").belowOrEqual(second).toArray();
        return db.sessions.toArray();
      })() as unknown as Promise<T>;
      case "sessions.lastForTask": return (async () => {
        const [taskId, itemId, before] = parameters;
        const ids = typeof itemId === "number" ? (await db.tasks.where("itemId").equals(itemId).toArray()).flatMap((task) => task.id === undefined ? [] : [task.id]) : typeof taskId === "number" ? [taskId] : [];
        if (!ids.length || typeof before !== "string") return null;
        const sessions = await db.sessions.where("taskId").anyOf(ids).and((session) => session.date < before).sortBy("date");
        return sessions.at(-1) ?? null;
      })() as unknown as Promise<T>;
      case "sessions.recentBpms": return (async () => {
        const [itemId, before] = parameters;
        if (typeof itemId !== "number" || typeof before !== "string") return [];
        const ids = (await db.tasks.where("itemId").equals(itemId).toArray()).flatMap((task) => task.id === undefined ? [] : [task.id]);
        if (!ids.length) return [];
        const sessions = await db.sessions.where("taskId").anyOf(ids).and((session) => session.date < before && session.bpmReached !== undefined).sortBy("date");
        return sessions.slice(-3).flatMap((session) => session.bpmReached === undefined ? [] : [session.bpmReached]);
      })() as unknown as Promise<T>;
      case "sessions.segmentHistory": return (async () => {
        if (typeof first !== "number") return [];
        const ids = (await db.tasks.where("itemId").equals(first).toArray()).flatMap((task) => task.id === undefined ? [] : [task.id]);
        return ids.length ? db.sessions.where("taskId").anyOf(ids).toArray() : [];
      })() as unknown as Promise<T>;
      case "sessions.bpmSuggestion": return (async () => {
        const [itemId, before] = parameters;
        if (typeof itemId !== "number" || typeof before !== "string") return null;
        const ids = (await db.tasks.where("itemId").equals(itemId).toArray()).flatMap((task) => task.id === undefined ? [] : [task.id]);
        const sessions = ids.length ? await db.sessions.where("taskId").anyOf(ids).and((session) => session.date < before && !!session.bpmReached).sortBy("date") : [];
        const lastThree = sessions.slice(-3); const bpm = lastThree[0]?.bpmReached;
        if (lastThree.length < 3 || bpm === undefined || !lastThree.every((session) => session.bpmReached === bpm && (session.quality === "well" || session.quality === "great") && (session.confidence ?? 0) >= 4)) return null;
        const steps = [2, 3, 4, 5, 8, 10]; const step = steps.find((value) => bpm % value === 0) ?? 5; const next = bpm + step;
        if (next > 400 || (ids.length && await db.sessions.where("taskId").anyOf(ids).and((session) => (session.bpmReached ?? 0) >= next).first())) return null;
        return { reached: bpm, next };
      })() as unknown as Promise<T>;
      case "subjects.one": return (typeof first === "number" ? db.subjects.get(first) : Promise.resolve(undefined)) as unknown as Promise<T>;
      case "subjects.isTheory": return (typeof first === "number" ? db.subjects.get(first).then((subject) => subject?.type === "theory") : Promise.resolve(false)) as unknown as Promise<T>;
      case "profile.current": return db.profile.get("me") as unknown as Promise<T>;
      case "routines.active": return db.studyRoutines.filter(active).toArray() as unknown as Promise<T>;
      case "recurrences.active": return db.recurrences.filter(active).toArray() as unknown as Promise<T>;
      case "assignments.pending": return db.assignments.filter((assignment) => !assignment.transformed && !assignment.ignored).toArray() as unknown as Promise<T>;
      case "helpRequests.answeredCount": return (typeof first === "number" ? db.helpRequests.where("itemId").equals(first).filter((request) => !!request.answer).count() : Promise.resolve(0)) as unknown as Promise<T>;
      case "helpRequests.item": return (typeof first === "number" ? db.helpRequests.where("itemId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "helpRequests.answeredItem": return (typeof first === "number" ? db.helpRequests.where("itemId").equals(first).filter((request) => !!request.answer).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "helpRequests.answeredItemIds": return db.helpRequests.filter((request) => !!request.answer && !!request.itemId).toArray().then((requests) => new Set(requests.map((request) => request.itemId!))) as unknown as Promise<T>;
      case "lessons.all": return db.lessons.orderBy("date").reverse().toArray() as unknown as Promise<T>;
      case "assignments.all": return db.assignments.toArray() as unknown as Promise<T>;
      case "assignments.lesson": return (typeof first === "number" ? db.assignments.where("lessonId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "pendingAssignments.subject": return (async () => {
        if (typeof first !== "number") return [];
        const rows = await db.pendingAssignments.where("subjectId").equals(first).toArray();
        return typeof second === "number" ? rows.filter((row) => row.recurrenceId == null || row.recurrenceId === second) : rows;
      })() as unknown as Promise<T>;
      case "helpRequests.all": return db.helpRequests.toArray() as unknown as Promise<T>;
      case "helpRequests.openCount": return db.helpRequests.filter((request) => !request.resolved).count() as unknown as Promise<T>;
      case "collections.active": return db.collections.filter((row) => active(row) && (!first || row.kind === first)).toArray() as unknown as Promise<T>;
      case "collections.all": return db.collections.toArray() as unknown as Promise<T>;
      case "collections.items": return (typeof first === "number" ? db.collectionItems.where("collectionId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "collections.one": return (typeof first === "number" ? db.collections.get(first) : Promise.resolve(undefined)) as unknown as Promise<T>;
      case "collectionLinks.all": return db.collectionItems.toArray() as unknown as Promise<T>;
      case "collectionLinks.item": return (typeof first === "number" ? db.collectionItems.where("itemId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "segments.ids": return (Array.isArray(first) && first.every((id) => typeof id === "number") ? db.segments.where("id").anyOf(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "library.subject": return (typeof first === "number" ? db.library.where("subjectId").equals(first).filter(active).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "routines.one": return (typeof first === "number" ? db.studyRoutines.get(first).then((routine) => routine ?? null) : Promise.resolve(null)) as unknown as Promise<T>;
      default: throw new Error(`Unknown presentation read operation: ${operation}`);
    }
  },
  assignmentsForLesson(lessonId) {
    return this.read("assignments.lesson", [lessonId]);
  },
  pendingAssignmentsForSubject(subjectId, recurrenceId) {
    return this.read("pendingAssignments.subject", [subjectId, recurrenceId]);
  },
  openHelpRequestCount() {
    return this.read("helpRequests.openCount");
  },
  subscribe(listener) {
    const subscription = liveQuery(() => Promise.all(db.tables.map((table) => table.toArray()))).subscribe({ next: listener });
    return () => subscription.unsubscribe();
  },
};
