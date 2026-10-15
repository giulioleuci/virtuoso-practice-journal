import Dexie from "dexie";
import { meanConfidence, topBpm } from "@/domain/logic/sessionMetrics";
import type { PresentationReadPort } from "@/application/queries/presentationReadPort";
import { db } from "./db";

const active = <T extends { deletedAt?: number }>(row: T) => !row.deletedAt;

const listeners = new Set<() => void>();
let hooked = false;
let scheduled = false;
function ensureMutationHook() {
  if (hooked) return;
  hooked = true;
  Dexie.on("storagemutated", () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      for (const l of [...listeners]) l();
    });
  });
}

/** Dexie implementation of named presentation read DTO operations. */
export const dexiePresentationReads: PresentationReadPort = {
  async read<T>(operation: string, parameters: readonly unknown[] = []): Promise<T> {
    const [first, second] = parameters;
    switch (operation) {
      case "subjects.active": return db.subjects.filter(active).toArray() as unknown as Promise<T>;
      case "techniques.active": return db.techniques.filter(active).toArray() as unknown as Promise<T>;
      case "library.active": return db.library.filter(active).toArray() as unknown as Promise<T>;
      case "library.repertoire": return db.library.where("kind").equals("repertoire").filter(active).toArray() as unknown as Promise<T>;
      case "repertoire.active": return db.library.filter((row) => active(row) && !!row.inRepertoire).toArray() as unknown as Promise<T>;
      case "performances.active": return db.performances.filter(active).toArray() as unknown as Promise<T>;
      case "performances.links": return db.performanceItems.toArray() as unknown as Promise<T>;
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
        const sessionsByTask: Record<number, typeof sessions> = {};
        for (const session of sessions) if (session.taskId !== undefined) (sessionsByTask[session.taskId] ??= []).push(session);
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
        if (typeof before !== "string") return null;
        const rows = typeof itemId === "number" ? db.sessions.where("itemId").equals(itemId) : typeof taskId === "number" ? db.sessions.where("taskId").equals(taskId) : null;
        const sessions = rows ? await rows.and((session) => session.date < before).sortBy("date") : [];
        return sessions.at(-1) ?? null;
      })() as unknown as Promise<T>;
      case "sessions.recentBpms": return (async () => {
        const [itemId, before] = parameters;
        if (typeof itemId !== "number" || typeof before !== "string") return [];
        const sessions = await db.sessions.where("itemId").equals(itemId).and((session) => session.date < before && topBpm(session.marks) !== undefined).sortBy("date");
        return sessions.slice(-3).flatMap((session) => topBpm(session.marks) ?? []);
      })() as unknown as Promise<T>;
      case "sessions.segmentHistory": return (typeof first === "number" ? db.sessions.where("itemId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "sessions.bpmSuggestion": return (async () => {
        const [itemId, before] = parameters;
        if (typeof itemId !== "number" || typeof before !== "string") return null;
        const sessions = await db.sessions.where("itemId").equals(itemId).and((session) => session.date < before && !!topBpm(session.marks)).sortBy("date");
        const lastThree = sessions.slice(-3); const bpm = topBpm(lastThree[0]?.marks ?? []);
        if (lastThree.length < 3 || bpm === undefined || !lastThree.every((session) => topBpm(session.marks) === bpm && (meanConfidence(session.marks) ?? 0) >= 4)) return null;
        const steps = [2, 3, 4, 5, 8, 10]; const step = steps.find((value) => bpm % value === 0) ?? 5; const next = bpm + step;
        if (next > 400 || await db.sessions.where("itemId").equals(itemId).and((session) => (topBpm(session.marks) ?? 0) >= next).first()) return null;
        return { reached: bpm, next };
      })() as unknown as Promise<T>;
      case "recordings.session": return (typeof first === "number" ? db.recordings.where("sessionId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "recordings.item": return (async () => {
        if (typeof first !== "number") return [];
        const ids = await db.sessions.where("itemId").equals(first).primaryKeys();
        return ids.length ? db.recordings.where("sessionId").anyOf(ids).toArray() : [];
      })() as unknown as Promise<T>;
      case "subjects.one": return (typeof first === "number" ? db.subjects.get(first) : Promise.resolve(undefined)) as unknown as Promise<T>;
      case "subjects.isTheory": return (typeof first === "number" ? db.subjects.get(first).then((subject) => subject?.type === "theory") : Promise.resolve(false)) as unknown as Promise<T>;
      case "profile.current": return db.profile.get("me").then((profile) => profile ?? null) as unknown as Promise<T>;
      case "routines.active": return db.studyRoutines.filter(active).toArray() as unknown as Promise<T>;
      case "recurrences.active": return db.recurrences.filter(active).toArray() as unknown as Promise<T>;
      case "assignments.pending": return db.assignments.filter((assignment) => !assignment.taskIds.length && !assignment.ignored).toArray() as unknown as Promise<T>;
      case "helpRequests.answeredCount": return (typeof first === "number" ? db.helpRequests.where("itemId").equals(first).filter((request) => !!request.answer).count() : Promise.resolve(0)) as unknown as Promise<T>;
      case "helpRequests.item": return (typeof first === "number" ? db.helpRequests.where("itemId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "helpRequests.answeredItem": return (typeof first === "number" ? db.helpRequests.where("itemId").equals(first).filter((request) => !!request.answer).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "helpRequests.answeredItemIds": return db.helpRequests.filter((request) => !!request.answer && !!request.itemId).toArray().then((requests) => new Set(requests.map((request) => request.itemId!))) as unknown as Promise<T>;
      case "lessons.all": return db.lessons.orderBy("date").reverse().toArray() as unknown as Promise<T>;
      case "assignments.all": return db.assignments.toArray() as unknown as Promise<T>;
      case "assignments.lesson": return (typeof first === "number" ? db.assignments.where("lessonId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
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
  openHelpRequestCount() {
    return this.read("helpRequests.openCount");
  },
  subscribe(listener) {
    // One shared, lightweight mutation listener instead of re-reading every table per hook.
    listeners.add(listener);
    ensureMutationHook();
    return () => { listeners.delete(listener); };
  },
};
