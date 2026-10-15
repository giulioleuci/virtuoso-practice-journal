# Practice Results, Free Sessions and Predictable Planning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-section mood/focus/confidence results, sessions that no longer need a task, coverage-based completion, opt-in plan updates, simpler routines, evidence instead of a readiness percentage, CSV export with a data-only backup, and device-local audio clips.

**Architecture:** Extend the records that already exist instead of adding layers. `SegmentMark` gains `mood`/`focus`, `Session` gains its own subject/content references plus `notStudied`, `Task` gains `customized`. Dexie v14 back-fills the new session references (no wipe); v15 adds a `recordings` metadata table. Audio bytes live in a second Dexie database (`virtuoso-audio`) that backup export/import never iterate, linked to metadata only by a random UUID.

**Tech Stack:** React 18 + TypeScript + Vite, Dexie 4, zod 3, Vitest + jsdom + fake-indexeddb + Testing Library, sonner toasts, shadcn/ui, Capacitor 8 (Android WebView), browser `MediaRecorder`.

**Spec:** `docs/superpowers/specs/2026-10-15-practice-experience-design.md`

## Global Constraints

- No timer, stopwatch, session duration, minute goals or time-studied statistics anywhere. A clip's `durationMs` is player metadata only and never appears in CSV or stats.
- No journal/notebook entity or page, no guided mode, no deliberate-practice flow, no mandatory pedagogical questions.
- Ratings are integers 1–5. New sessions need `mood`, `focus` and `confidence` on every studied section. Legacy records keep missing values missing — never default them (no "3").
- Mood and focus never feed readiness, plans, completion or routine weighting (routine stats keep using confidence only).
- Saving a session never edits future tasks and never triggers regeneration for routines whose adaptivity is `uniform`.
- JSON backup and CSV contain data only: no blob, base64, audio archive, absolute device path or object URL. No audio import/export/share in the app.
- Required UI copy (Italian verbatim, translate to en/es/de):
  - Recorder / clip list: «Le registrazioni restano su questo dispositivo. Non sono incluse nei backup e non possono essere importate o esportate.»
  - Backup export button: «Esporta backup dei dati»; text «Include dati e valutazioni. Non include i file audio.»
  - Import: «Importa solo dati. I file audio non vengono ripristinati. Le registrazioni locali non vengono importate o esportate.»
  - CSV: «Esporta dati CSV — senza file audio»
  - Missing clip: «Audio non disponibile su questo dispositivo. Il backup contiene solo i dati della registrazione.»
  - Next-task action: «Aggiorna la prossima attività»; restart action: «Riparti da questi valori»; apply action: «Applica questi valori agli altri segmenti»; matrix: «Personalizza la settimana».
- CSV: files `sessioni.csv` and `risultati.csv`, English column names, ISO `YYYY-MM-DD`, UTF-8 with BOM, missing = empty cell, arrays as JSON, formula-guarded text. No CSV importer.
- Migrations are atomic, idempotent Dexie upgrades. No data wipe as a shortcut.
- No new npm dependency.
- Every new string goes into all four `src/lib/language/{it,en,es,de}.json` files; interpolation is `{{var}}`, plural is the `_plural` key suffix chosen by `count`.
- Presentation code (`src/pages`, `src/components`, `src/hooks`, `src/presentation`) must not use `Blob`, `FileReader`, `URL.createObjectURL`, dexie or `@/infrastructure` (enforced by `src/test/architecture/import-boundaries.test.ts`); it reaches infrastructure only through `applicationCommands` (`src/lib/applicationCommands.ts`). Domain code must not touch `window`, `document`, `navigator` (enforced by `src/domain/domain-boundaries.test.ts`).
- The workspace carries ~190 uncommitted files from earlier work. Commit only the paths listed in each task (`git add <paths>`), never `git add -A` / `git commit -a`.
- Baseline before Task 1: `npx vitest run` → 44 files, 348 tests passing.

## Review Focus

1. **Session whose task was hard-deleted, and v2 backups without session references** — history, CSV and evidence must still render from the snapshot; the migration must keep such a row untouched instead of failing. Pinned in Task 1 (migration test, orphan session) and Task 4 (v2 import back-fill).
2. **Section deleted from the library after it was logged** — its result keeps its snapshot label in history, and evidence counts coverage only against the piece's current sections. Pinned in Task 3 (`pieceEvidence` test with an unknown section id).
3. **Session save fails after clips were recorded** — no `recordings` row survives the rollback, the drafts stay usable, and a retry saves them. Pinned in Task 5 (rollback test).
4. **Imported backup reuses numeric ids/sessionIds that exist locally** — a clip plays only when audio with the same UUID exists; local audio is never deleted or re-linked. Pinned in Task 5 (collision test).
5. **CSV text with leading `=` `+` `-` `@`, quotes, newlines, accents and arrays** — spreadsheet-safe cells and intact row structure. Pinned in Task 4 (`csvCell` / `practiceCsv` tests).

---

### Task 1: Per-section ratings, task-optional sessions, coverage completion

Covers spec §3 (Task, Session, Result), §4, §5, §8 (without clips), §12, PRODUCT.md update.

**Files:**
- Modify: `src/domain/entities/common.ts`, `src/domain/entities/session.ts`
- Create: `src/domain/logic/sessionContext.ts`
- Modify: `src/domain/logic/plan.ts`, `src/domain/logic/sessionMetrics.ts`, `src/domain/logic/progress.ts`
- Modify: `src/domain/ports/session.ts`, `src/domain/ports/task.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/application/useCases/logSession.ts`
- Modify: `src/infrastructure/dexie/db.ts`, `src/infrastructure/dexie/presentationReadPort.ts`
- Modify: `src/infrastructure/repositories/dexie/sessionRepository.ts`, `taskRepository.ts`, `studyRoutineRepository.ts`
- Modify: `src/presentation/hooks/useReadiness.ts`
- Create: `src/components/shared/RatingScale.tsx`; Delete: `src/components/shared/StarRating.tsx`
- Modify: `src/components/diary/MarksEditor.tsx`, `src/components/diary/CompletionBar.tsx`
- Modify: `src/pages/SessionLogPage.tsx`, `src/pages/SessionPage.tsx`, `src/pages/Diary.tsx`, `src/pages/History.tsx`, `src/pages/PrintSummary.tsx`
- Modify: `src/lib/sampleData.ts`, `src/lib/language/{it,en,es,de}.json`, `PRODUCT.md`, `CLAUDE.md`
- Test: `src/application/useCases/taskSession.test.ts`, `src/infrastructure/repositories/dexie/repositories.test.ts`, `src/domain/logic/progress.test.ts`, `src/domain/domain-boundaries.test.ts`
- Create test: `src/infrastructure/dexie/migration.test.ts`
- Modify fakes: `src/test/fakes/FakeSessionRepository.ts`, `src/test/fakes/FakeTaskRepository.ts`

**Interfaces:**
- Consumes: existing `planSegmentIds`, `entryFor`, `marksFromPlan`, `emptyEntry` (`src/domain/logic/plan.ts`), `buildDexieSessionSnapshot`, `useSessionSubmission`.
- Produces (later tasks rely on these exact names):
  - `SegmentMark.mood?: number`, `SegmentMark.focus?: number`; `RATING_KEYS = ["mood","focus","confidence"] as const`; `type RatingKey`
  - `Session { id; taskId?; subjectId?; linkType?; itemId?; collectionId?; date; notes?; marks; notStudied?: number[]; snapshot?; createdAt }`
  - `sessionContext(source: Pick<Task,"subjectId"|"linkType"|"itemId"|"collectionId">): Pick<Session,"subjectId"|"linkType"|"itemId"|"collectionId">`
  - `withSessionContext<S extends Partial<Session>>(sessions: S[], tasks: (Pick<Task, "subjectId" | "linkType" | "itemId" | "collectionId"> & { id?: number })[]): S[]`
  - `remainingSegmentIds(plan: SegmentEntry[], sessions: Pick<Session,"marks">[]): number[]`; `planCovered(plan, sessions): boolean`
  - `meanRating(marks: SegmentMark[], key: RatingKey): number | undefined`; `meanConfidence(marks)`; `missingRatings(mark: SegmentMark): RatingKey[]`
  - `type SessionTarget = Pick<Task,"subjectId"|"linkType"|"itemId"|"collectionId"|"title"|"plan"> & { id?: number }`
  - `type SessionLogInput = Pick<Session,"date"|"notes"|"marks"> & { helpText?: string }`
  - `SessionLogTransaction.syncTaskDone(taskId: number): Promise<void>` (replaces `completeTask`)
  - `LogSessionUseCase.execute(target: SessionTarget, input: SessionLogInput): Promise<number>`
  - `ratingSchema`, `sessionInputSchema` (lenient), `newSessionInputSchema` (all three ratings, ≥1 entry, one entry per section)
  - `<RatingScale label question labels value onChange unanswered required? />`
  - `<MarksEditor marks onChange sections? seed? layerOptions techniqueOptions isTheory requireRatings? />`
  - Dexie v14 `sessions: "++id, taskId, date, subjectId, itemId"` (queries by `itemId` now hit sessions directly)

- [ ] **Step 1: Write the failing use-case tests**

In `src/application/useCases/taskSession.test.ts`, add after `baseTask`:

```ts
const rated = (segmentId?: number) => ({ segmentId, layers: [], techniques: [], mood: 4, focus: 3, confidence: 5 });
const sectioned = { ...baseTask, linkType: "item" as const, itemId: 9, plan: [1, 2, 3].map((segmentId) => ({ segmentId, layers: [], techniques: [] })) };
```

Replace every `marks: [{ layers: [], techniques: [], confidence: 3 }]` in the two existing "logs completion…" / "assembles an effective snapshot…" tests with `marks: [{ ...rated(), confidence: 3 }]`, and `marks: [{ bpm: 120, layers: ["hands"], techniques: [4], confidence: 3 }]` with `marks: [{ ...rated(), bpm: 120, layers: ["hands"], techniques: [4], confidence: 3 }]`. Then append inside the `describe`:

```ts
  it("saves a free session without creating or completing any task", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const sessions = new FakeSessionRepository(tasks);

    await new LogSessionUseCase(sessions, () => 5).execute(
      { subjectId: 1, linkType: "free", title: "Improvisation", plan: [] },
      { date: "2026-07-20", marks: [rated()] },
    );

    expect(sessions.sessions[0]).toMatchObject({ subjectId: 1, linkType: "free", marks: [{ mood: 4, focus: 3, confidence: 5 }] });
    expect(sessions.sessions[0].taskId).toBeUndefined();
    expect(tasks.created).toHaveLength(0);
    expect(tasks.updated.size).toBe(0);
  });

  it("rejects a new session with a missing rating and saves nothing", async () => {
    const tasks = new FakeTaskRepository([baseTask]);
    const sessions = new FakeSessionRepository(tasks);

    await expect(new LogSessionUseCase(sessions).execute(baseTask, { date: "2026-07-20", marks: [{ layers: [], techniques: [], mood: 4, confidence: 5 }] })).rejects.toThrow(/focus/);
    await expect(new LogSessionUseCase(sessions).execute(sectioned, { date: "2026-07-20", marks: [rated(1), rated(1)] })).rejects.toThrow(/once/);
    expect(sessions.sessions).toHaveLength(0);
  });

  it("stores one rated result per studied section and records the planned ones left out", async () => {
    const tasks = new FakeTaskRepository([sectioned]);
    const sessions = new FakeSessionRepository(tasks);

    await new LogSessionUseCase(sessions).execute(sectioned, { date: "2026-07-20", marks: [rated(1), rated(3)] });

    expect(sessions.sessions[0].marks.map((m) => m.segmentId)).toEqual([1, 3]);
    expect(sessions.sessions[0].notStudied).toEqual([2]);
    expect(sessions.sessions[0]).toMatchObject({ taskId: 1, itemId: 9, linkType: "item" });
    expect(tasks.updated.get(1)).toEqual({ done: false });
  });

  it("completes a task from cumulative coverage and reopens it when a covering session is deleted", async () => {
    const tasks = new FakeTaskRepository([sectioned]);
    const sessions = new FakeSessionRepository(tasks);
    const log = new LogSessionUseCase(sessions);

    await log.execute(sectioned, { date: "2026-07-20", marks: [rated(1), rated(2)] });
    await log.execute(sectioned, { date: "2026-07-21", marks: [rated(3)] });
    expect(tasks.updated.get(1)).toEqual({ done: true });

    await new DeleteSessionUseCase(sessions).execute(2, 1);
    expect(tasks.updated.get(1)).toEqual({ done: false });
    expect(sessions.sessions[0].marks).toHaveLength(2);
  });
```

- [ ] **Step 2: Write the failing migration test**

Create `src/infrastructure/dexie/migration.test.ts`:

```ts
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";

// Cumulative v13 schema, copied from db.ts, so the upgrade runs against a real older database.
const V13 = {
  profile: "id", subjects: "++id, name, type, deletedAt", techniques: "++id, subjectId, name, deletedAt",
  library: "++id, subjectId, kind, title, deletedAt, inRepertoire, nextReviewAt", segments: "++id, itemId, deletedAt",
  tasks: "++id, date, subjectId, itemId, collectionId, done, deletedAt, studyRoutineId, recurrenceTaskId",
  sessions: "++id, taskId, date", helpRequests: "++id, sessionId, itemId, resolved", recurrences: "++id, subjectId, deletedAt",
  lessons: "++id, recurrenceId, subjectId, date", assignments: "++id, lessonId, *taskIds",
  collections: "++id, name, kind, composer, defaultSubjectId, deletedAt", collectionItems: "++id, collectionId, itemId, [collectionId+itemId]",
  studyRoutines: "++id, subjectId, deletedAt", performances: "++id, date, subjectId, deletedAt", performanceItems: "++id, eventId, itemId, [eventId+itemId]",
};

it("v14 back-fills session references from their task, keeps orphans and wipes nothing", async () => {
  const legacy = new Dexie("virtuoso");
  legacy.version(13).stores(V13);
  await legacy.open();
  await legacy.table("tasks").add({ id: 1, date: "2026-10-01", subjectId: 7, linkType: "item", itemId: 3, title: "Ballade", plan: [], done: true, createdAt: 1 });
  await legacy.table("sessions").bulkAdd([
    { id: 1, taskId: 1, date: "2026-10-01", notes: "kept", marks: [{ layers: [], techniques: [], confidence: 4 }], createdAt: 1 },
    { id: 2, taskId: 99, date: "2026-10-02", marks: [], snapshot: { taskTitle: "Gone", subjectName: "Piano" }, createdAt: 2 },
  ]);
  legacy.close();

  const { db } = await import("./db");
  await db.open();

  expect(await db.sessions.get(1)).toMatchObject({ taskId: 1, subjectId: 7, linkType: "item", itemId: 3, notes: "kept", marks: [{ confidence: 4 }] });
  expect((await db.sessions.get(1))?.marks[0].mood).toBeUndefined();
  expect(await db.sessions.get(2)).toMatchObject({ taskId: 99, snapshot: { taskTitle: "Gone" } });
  expect((await db.sessions.get(2))?.subjectId).toBeUndefined();
  expect(await db.tasks.count()).toBe(1);
  expect(await db.sessions.where("itemId").equals(3).count()).toBe(1);
});
```

- [ ] **Step 3: Write the failing repository tests**

In `src/infrastructure/repositories/dexie/repositories.test.ts`, add below `subjectId()`:

```ts
const ratedMark = (segmentId?: number) => ({ segmentId, layers: [], techniques: [], mood: 3, focus: 3, confidence: 3 });
```

Replace `marks: []` with `marks: [ratedMark()]` in the two `LogSessionUseCase(...).execute(task, …)` calls of "logs immutable session snapshot and completes task" and "rolls back session and task completion when help logging fails". Append inside the `describe`:

```ts
  it("persists a free session with its own references and no task", async () => {
    const subject = await subjectId();
    const id = await new LogSessionUseCase(sessionRepository, () => 1).execute({ subjectId: subject, linkType: "free", title: "Sight-reading", plan: [] }, { date: "2026-01-02", marks: [ratedMark()] });
    expect(await db.sessions.get(id)).toMatchObject({ subjectId: subject, linkType: "free", snapshot: { taskTitle: "Sight-reading" } });
    expect(await db.tasks.count()).toBe(0);
  });

  it("reopens a covered task when new sections are added to its plan", async () => {
    const subject = await subjectId();
    const taskId = await taskRepository.create({ title: "Etude", date: "2026-01-01", subjectId: subject, plan: [{ segmentId: 1, layers: [], techniques: [] }] });
    const task = (await db.tasks.get(taskId))!;
    await new LogSessionUseCase(sessionRepository, () => 1).execute(task, { date: "2026-01-01", marks: [ratedMark(1)] });
    expect((await db.tasks.get(taskId))?.done).toBe(true);

    await taskRepository.update(taskId, { plan: [...task.plan, { segmentId: 2, layers: [], techniques: [] }] });
    expect((await db.tasks.get(taskId))?.done).toBe(false);
  });
```

In `src/domain/domain-boundaries.test.ts` replace

```ts
    expect(source).toContain("completeTask(taskId: number): Promise<void>;");
```

with

```ts
    expect(source).toContain("syncTaskDone(taskId: number): Promise<void>;");
```

In `src/domain/logic/progress.test.ts` give every session its subject (sessions of task 1 get `subjectId: 10`, of task 2 `subjectId: 20`), e.g. `{ taskId: 1, subjectId: 10, date: "2026-10-05", marks: [...] }`, including the `seg` fixture.

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run src/application/useCases/taskSession.test.ts src/infrastructure/dexie/migration.test.ts src/infrastructure/repositories/dexie/repositories.test.ts src/domain/domain-boundaries.test.ts`
Expected: FAIL — TypeScript/vitest errors on `mood`, `SessionTarget`-shaped targets ("Cannot log a session for an unsaved task"), `notStudied` undefined, `syncTaskDone` missing, migration `subjectId` undefined.

- [ ] **Step 5: Domain types and pure logic**

`src/domain/entities/common.ts` — replace the `SegmentMark` interface with:

```ts
/** Result of practicing one section: reached tempo, three 1-5 ratings and the planned target at that time. */
export interface SegmentMark extends SegmentEntry {
  confidence?: number;
  /** 1 very negative … 5 very positive: how working on the section felt. */
  mood?: number;
  /** 1 very low … 5 very high: how well attention held. */
  focus?: number;
  targetBpm?: number;
}

/** The three per-section ratings in display order; each is an integer 1-5. */
export const RATING_KEYS = ["mood", "focus", "confidence"] as const;
export type RatingKey = typeof RATING_KEYS[number];
```

`src/domain/entities/session.ts` — replace the `Session` interface (keep `SessionSnapshot`):

```ts
import type { SegmentMark } from "./common";
import type { TaskLinkType } from "./task";

export interface Session {
  id: number;
  /** Set only when the session was opened from a planned task. */
  taskId?: number;
  /** Absent only on legacy sessions whose task no longer exists. */
  subjectId?: number;
  linkType?: TaskLinkType;
  itemId?: number;
  collectionId?: number;
  date: string;
  notes?: string;
  /** One entry per studied section, or a single whole-scope entry. */
  marks: SegmentMark[];
  /** Sections of the task's plan declared not studied in this session. */
  notStudied?: number[];
  snapshot?: SessionSnapshot;
  createdAt: number;
}
```

Create `src/domain/logic/sessionContext.ts`:

```ts
import type { Session } from "../entities/session";
import type { Task } from "../entities/task";

type ContextSource = Pick<Task, "subjectId" | "linkType" | "itemId" | "collectionId">;

/** References a session keeps itself, so history and queries work without its task. */
export const sessionContext = (source: ContextSource): Pick<Session, "subjectId" | "linkType" | "itemId" | "collectionId"> => ({
  subjectId: source.subjectId,
  linkType: source.linkType ?? (source.collectionId !== undefined ? "collection" : source.itemId !== undefined ? "item" : "free"),
  itemId: source.itemId,
  collectionId: source.collectionId,
});

/** Legacy sessions filled from their task; sessions already carrying a subject, or whose task is gone, are returned as they are. */
export function withSessionContext<S extends Partial<Session>>(sessions: S[], tasks: (ContextSource & { id?: number })[]): S[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return sessions.map((session) => {
    const task = session.taskId === undefined ? undefined : byId.get(session.taskId);
    return task && session.subjectId === undefined ? { ...sessionContext(task), ...session } : session;
  });
}
```

`src/domain/logic/plan.ts` — add `import type { Session } from "../entities/session";`, delete `unratedMarks`, append:

```ts
/** Planned sections that none of `sessions` has a result for. */
export const remainingSegmentIds = (plan: SegmentEntry[], sessions: Pick<Session, "marks">[]): number[] => {
  const studied = new Set(sessions.flatMap((s) => s.marks.map((m) => m.segmentId)));
  return planSegmentIds(plan).filter((id) => !studied.has(id));
};

/** A task is done once its sessions cover every planned section; a task without sections needs one studied entry. */
export const planCovered = (plan: SegmentEntry[], sessions: Pick<Session, "marks">[]): boolean =>
  planSegmentIds(plan).length ? remainingSegmentIds(plan, sessions).length === 0 : sessions.some((s) => s.marks.length > 0);
```

`src/domain/logic/sessionMetrics.ts` — replace `meanConfidence` with:

```ts
import { RATING_KEYS, type RatingKey, type SegmentMark } from "../entities/common";

/** Mean of one rating over the marks that have it. */
export function meanRating(marks: SegmentMark[], key: RatingKey): number | undefined {
  const rated = marks.flatMap((m) => { const value = m[key]; return value ? [value] : []; });
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : undefined;
}

export const meanConfidence = (marks: SegmentMark[]) => meanRating(marks, "confidence");

/** Ratings a new session still needs on this mark. */
export const missingRatings = (mark: SegmentMark): RatingKey[] => RATING_KEYS.filter((key) => mark[key] === undefined);
```

(Keep the existing `topMark`/`topBpm` and the existing `import type { SegmentMark }` merged into the new import line.)

`src/domain/logic/progress.ts` — the session parameter becomes `Pick<Session, "taskId" | "subjectId" | "itemId" | "date" | "marks">[]`, and the loop head becomes:

```ts
  for (const s of sessions) {
    const task = s.taskId === undefined ? undefined : taskById.get(s.taskId);
    if (f.subjectId != null && s.subjectId !== f.subjectId) continue;
    if (f.itemId != null && s.itemId !== f.itemId) continue;
```

- [ ] **Step 6: Schemas, port and use case**

`src/lib/schemas.ts` — replace `confidenceSchema`, `segmentMarkSchema`, `sessionInputSchema` with:

```ts
export const ratingSchema = z.number().int().min(1).max(5);

export const segmentMarkSchema = segmentEntrySchema.extend({
  confidence: ratingSchema.optional(),
  mood: ratingSchema.optional(),
  focus: ratingSchema.optional(),
  targetBpm: bpmSchema.optional(),
});

const oneEntryPerSection = (marks: { segmentId?: number }[]) => new Set(marks.map((m) => m.segmentId ?? "whole")).size === marks.length;

/** Edits of stored sessions: historical marks may lack ratings. */
export const sessionInputSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  marks: z.array(segmentMarkSchema).refine(oneEntryPerSection, "Each section appears once"),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

/** New sessions: at least one studied entry, each with all three ratings. */
export const newSessionInputSchema = sessionInputSchema.extend({
  marks: z.array(segmentMarkSchema.required({ confidence: true, mood: true, focus: true })).min(1).refine(oneEntryPerSection, "Each section appears once"),
});
```

`src/domain/ports/session.ts` — replace the file with:

```ts
import type { Session, SessionSnapshot } from "../entities/session";
import type { Task } from "../entities/task";

export type PersistedTask = Task & { id: number };

/** What a session is about: the task it was opened from (`id` set) or a free choice of subject and content. */
export type SessionTarget = Pick<Task, "subjectId" | "linkType" | "itemId" | "collectionId" | "title" | "plan"> & { id?: number };

export type SessionLogInput = Pick<Session, "date" | "notes" | "marks"> & {
  helpText?: string;
};

export interface SessionLogTransaction {
  createSession(session: Omit<Session, "id">): Promise<number>;
  /** Re-derives `done` from the cumulative section coverage of the task's sessions. */
  syncTaskDone(taskId: number): Promise<void>;
  createHelpRequest(request: { sessionId: number; taskId?: number; itemId?: number; question: string; createdAt: number }): Promise<void>;
}

export interface SessionPort {
  list(): Promise<Session[]>;
  byTask(taskId: number): Promise<Session[]>;
  log(task: Task, date: string, input: Omit<Session, "id" | "taskId" | "snapshot" | "createdAt">): Promise<number>;
  update(id: number, patch: Partial<Session>): Promise<void>;
  buildSnapshot(target: SessionTarget): Promise<SessionSnapshot>;
  transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>): Promise<T>;
  remove(id: number): Promise<void>;
  deleteWithTaskReset(sessionId: number, taskId?: number): Promise<void>;
  deleteByTaskAndDate(taskId: number, date: string): Promise<void>;
}
```

`src/domain/ports/task.ts` — delete the `findOrCreateForLog(...)` line (free sessions no longer create tasks).

`src/application/useCases/logSession.ts` — replace the file with:

```ts
import { planSegmentIds } from "@/domain/logic/plan";
import { sessionContext } from "@/domain/logic/sessionContext";
import type { SessionLogInput, SessionPort, SessionTarget } from "@/domain/ports/session";
import { newSessionInputSchema } from "@/lib/schemas";

export class LogSessionUseCase {
  constructor(private readonly sessions: SessionPort, private readonly clock: () => number = Date.now) {}

  /** Saves what was studied. A target with an `id` is the task the session was opened from; without one the session is free. */
  async execute(target: SessionTarget, input: SessionLogInput): Promise<number> {
    const checked = newSessionInputSchema.safeParse({ notes: input.notes, marks: input.marks });
    if (!checked.success) {
      const issue = checked.error.issues[0];
      throw new Error(`Invalid session: ${issue?.path.join(".")} ${issue?.message}`);
    }
    const createdAt = this.clock();
    const helpText = input.helpText?.trim() || undefined;
    const studied = new Set(input.marks.map((m) => m.segmentId));
    const notStudied = target.id === undefined ? [] : planSegmentIds(target.plan).filter((id) => !studied.has(id));
    // Labels of planned and studied sections alike, so history survives renames and deletions.
    const snapshot = await this.sessions.buildSnapshot({ ...target, plan: [...target.plan, ...input.marks] });
    return this.sessions.transaction(async (transaction) => {
      const sessionId = await transaction.createSession({
        taskId: target.id,
        ...sessionContext(target),
        date: input.date,
        notes: input.notes?.trim() || undefined,
        marks: input.marks,
        notStudied: notStudied.length ? notStudied : undefined,
        snapshot,
        createdAt,
      });
      if (target.id !== undefined) await transaction.syncTaskDone(target.id);
      if (helpText) await transaction.createHelpRequest({ sessionId, taskId: target.id, itemId: target.itemId, question: helpText, createdAt });
      return sessionId;
    });
  }
}
```

- [ ] **Step 7: Fakes**

`src/test/fakes/FakeTaskRepository.ts`: change the constructor to `constructor(readonly rows: Task[] = []) {}` and delete `findOrCreateForLog`.

`src/test/fakes/FakeSessionRepository.ts`: add `import { planCovered } from "@/domain/logic/plan";`, add the method

```ts
  private async syncTaskDone(taskId: number) {
    const task = this.tasks.rows.find((row) => row.id === taskId);
    await this.tasks.update(taskId, { done: planCovered(task?.plan ?? [], this.sessions.filter((s) => s.taskId === taskId)) });
  }
```

then in `transaction` replace `completeTask: (taskId) => this.tasks.update(taskId, { done: true }),` with `syncTaskDone: (taskId) => this.syncTaskDone(taskId),`, change the `helpRequests` field type to `{ sessionId: number; taskId?: number; question: string }[]`, and replace `deleteWithTaskReset` with

```ts
  async deleteWithTaskReset(id: number, taskId?: number) { await this.remove(id); if (taskId !== undefined) await this.syncTaskDone(taskId); }
```

- [ ] **Step 8: Dexie v14 and repositories**

`src/infrastructure/dexie/db.ts` — add `import { withSessionContext } from "@/domain/logic/sessionContext";` and, after the v13 block:

```ts
    // v14: sessions keep their own subject/content references (task optional); legacy rows are back-filled from their task, never cleared.
    this.version(14).stores({ sessions: "++id, taskId, date, subjectId, itemId" }).upgrade(async (tx) => {
      const sessions = tx.table("sessions");
      await sessions.bulkPut(withSessionContext(await sessions.toArray(), await tx.table("tasks").toArray()));
    });
```

`src/infrastructure/repositories/dexie/sessionRepository.ts` — change the snapshot signature to `export async function buildDexieSessionSnapshot(task: SessionTarget)` (import `SessionTarget` and `SessionLogTransaction` from `@/domain/ports/session`, `planCovered` from `@/domain/logic/plan`), add above `sessionRepository`:

```ts
/** Completion follows the sections covered by all of the task's sessions. Call inside a rw transaction on tasks + sessions. */
async function syncTaskDone(taskId: number) {
  const [task, sessions] = await Promise.all([db.tasks.get(taskId), db.sessions.where("taskId").equals(taskId).toArray()]);
  if (task) await db.tasks.update(taskId, { done: planCovered(task.plan, sessions) });
}
```

and replace `update`, `transaction`, `deleteWithTaskReset` with:

```ts
  async update(id: number, patch: Partial<Session>) {
    await db.transaction("rw", db.tasks, db.sessions, async () => {
      await db.sessions.update(id, patch);
      const taskId = (await db.sessions.get(id))?.taskId;
      if (patch.marks && taskId !== undefined) await syncTaskDone(taskId);
    });
  },
  transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>) {
    return db.transaction("rw", db.tasks, db.sessions, db.helpRequests, () => operation({
      createSession: (session) => db.sessions.add(session) as Promise<number>,
      syncTaskDone,
      createHelpRequest: async (request) => { await db.helpRequests.add({ ...request, resolved: false }); },
    }));
  },
  async deleteWithTaskReset(id: number, taskId?: number) {
    await db.transaction("rw", db.tasks, db.sessions, async () => { await db.sessions.delete(id); if (taskId !== undefined) await syncTaskDone(taskId); });
  },
```

(`remove` stays a separate one-liner; split the current `update: …, remove: …` line accordingly. `deleteByTaskAndDate` is the explicit "reopen" action and stays unchanged.)

`src/infrastructure/repositories/dexie/taskRepository.ts` — add `import { planCovered } from "@/domain/logic/plan";`, delete `findOrCreateForLog`, replace `update` with:

```ts
  async update(id: number, patch: Partial<Task>) {
    await db.transaction("rw", db.tasks, db.sessions, async () => {
      await db.tasks.update(id, patch);
      // Sections added to an already logged plan need their own coverage.
      if (!patch.plan) return;
      const sessions = await db.sessions.where("taskId").equals(id).toArray();
      if (sessions.length) await db.tasks.update(id, { done: planCovered(patch.plan, sessions) });
    });
  },
```

`src/infrastructure/repositories/dexie/studyRoutineRepository.ts` — in `computeStats` read only sessions and use their own references (mood/focus stay out; confidence only):

```ts
  const sessions = await db.sessions.toArray();
  // …byItem / byCollection / bySegment declarations unchanged…
  for (const session of sessions) {
    const row = { confidence: meanConfidence(session.marks), date: session.date, createdAt: session.createdAt };
    if (session.itemId !== undefined) byItem.set(session.itemId, [...(byItem.get(session.itemId) ?? []), row]);
    if (session.collectionId !== undefined) byCollection.set(session.collectionId, [...(byCollection.get(session.collectionId) ?? []), row]);
    for (const mark of session.marks) {
      if (mark.segmentId === undefined) continue;
      bySegment.set(mark.segmentId, [...(bySegment.get(mark.segmentId) ?? []), { confidence: mark.confidence, date: session.date, createdAt: session.createdAt }]);
    }
  }
```

and change its doc comment to "Reads sessions once, not once per entry."

`src/infrastructure/dexie/presentationReadPort.ts` — per-item session queries now hit `sessions.itemId` (this also brings free sessions on a piece into its history):

```ts
      case "tasks.diaryDate": return (async () => {
        if (typeof first !== "string") return { tasks: [], sessionsByTask: {} };
        const tasks = await db.tasks.where("date").equals(first).filter(active).toArray();
        const ids = tasks.flatMap((task) => task.id === undefined ? [] : [task.id]);
        const sessions = ids.length ? await db.sessions.where("taskId").anyOf(ids).toArray() : [];
        const sessionsByTask: Record<number, typeof sessions> = {};
        for (const session of sessions) if (session.taskId !== undefined) (sessionsByTask[session.taskId] ??= []).push(session);
        return { tasks, sessionsByTask };
      })() as unknown as Promise<T>;
```

```ts
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
```

`src/presentation/hooks/useReadiness.ts` — group sessions by `session.itemId` and drop the task lookup:

```ts
import { useMemo } from "react";
import type { LibraryItem } from "@/domain/entities/library";
import type { Session } from "@/domain/entities/session";
import { calculateReadiness } from "@/domain/logic/readiness";
import { today } from "@/lib/date";
import { useAllLibrary, useAllSegments, useSessions } from "./useEntities";

/** Readiness lookups for library items: sessions and segments per item, and the readiness breakdown. */
export function useReadiness() {
  const library = useAllLibrary();
  const sessions = useSessions();
  const segments = useAllSegments();

  return useMemo(() => {
    const todayKey = today();
    const byItem = new Map<number, Session[]>();
    for (const session of sessions ?? []) if (session.itemId !== undefined) byItem.set(session.itemId, [...(byItem.get(session.itemId) ?? []), session]);
    const sessionsOf = (itemId?: number) => (itemId === undefined ? [] : byItem.get(itemId) ?? []);
    const segmentsOf = (itemId?: number) => (segments ?? []).filter((segment) => segment.itemId === itemId);
    return {
      ready: library !== undefined && sessions !== undefined && segments !== undefined,
      itemsById: new Map((library ?? []).map((item) => [item.id, item])),
      sessionsOf,
      segmentsOf,
      readinessFor: (item: LibraryItem) => calculateReadiness(item, segmentsOf(item.id), sessionsOf(item.id), todayKey),
    };
  }, [library, sessions, segments]);
}
```

(Task 3 replaces `readinessFor`; this step only removes the task dependency.)

- [ ] **Step 9: Run the logic tests**

Run: `npx vitest run src/application src/infrastructure src/domain`
Expected: PASS (all, including the new migration test). If `tsc` errors remain in pages, they are fixed in the next steps.

- [ ] **Step 10: Rating UI — `RatingScale` and `MarksEditor`**

Create `src/components/shared/RatingScale.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** Five numbered choices for one 1-5 rating; the chosen label (or "not answered") is spelled out, so state never relies on colour. */
export function RatingScale({ label, question, labels, value, onChange, unanswered, required = false }: {
  label: string;
  question: string;
  /** Five labels; index 0 is value 1. */
  labels: string[];
  value: number | undefined;
  onChange: (value: number) => void;
  unanswered: string;
  required?: boolean;
}) {
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-xs font-medium text-foreground">{label}</legend>
      <p className="text-xs text-muted-foreground">{question}</p>
      <div role="group" aria-label={label} className="grid grid-cols-5 gap-1.5">
        {labels.map((text, i) => {
          const n = i + 1;
          return (
            <button key={n} type="button" aria-pressed={value === n} aria-label={`${n} — ${text}`} onClick={() => onChange(n)}
              className={cn("min-h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors", value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/40")}>
              {n}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={cn("text-xs", value === undefined && required ? "font-medium text-destructive" : "text-muted-foreground")}>
        {value === undefined ? unanswered : labels[value - 1]}
      </p>
    </fieldset>
  );
}
```

Delete `src/components/shared/StarRating.tsx` (its only user is `MarksEditor`).

Replace `src/components/diary/MarksEditor.tsx` with:

```tsx
import { toast } from "sonner";
import { RATING_KEYS, type RatingKey, type SegmentMark } from "@/domain/entities/common";
import { emptyEntry } from "@/domain/logic/plan";
import { missingRatings } from "@/domain/logic/sessionMetrics";
import { useI18n } from "@/lib/i18n";
import { BpmCoupler } from "@/components/library/BpmCoupler";
import { MultiChipPicker } from "@/components/shared/MultiChipPicker";
import { RatingScale } from "@/components/shared/RatingScale";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface Option<T extends string | number> { value: T; label: string }

/** One row per section: studied or not, the three ratings up front, tempo, then layers and techniques on demand. */
export function MarksEditor({ marks, onChange, sections, seed = emptyEntry, layerOptions, techniqueOptions, isTheory, requireRatings = true }: {
  marks: SegmentMark[];
  onChange: (marks: SegmentMark[]) => void;
  /** Sections on offer; empty or missing means one whole-scope entry. */
  sections?: { id: number; label: string }[];
  /** Entry added when a section is switched to studied (plan targets, never ratings). */
  seed?: (segmentId: number) => SegmentMark;
  layerOptions: Option<string>[];
  techniqueOptions: Option<number>[];
  isTheory: boolean;
  /** New sessions need every rating; edits of older records do not. */
  requireRatings?: boolean;
}) {
  const { t } = useI18n();
  const rows: { id?: number; label: string }[] = sections?.length ? sections : [{ label: "" }];
  const patch = (segmentId: number | undefined, p: Partial<SegmentMark>) => onChange(marks.map((m) => (m.segmentId === segmentId ? { ...m, ...p } : m)));
  const setStudied = (segmentId: number, on: boolean) => onChange(on ? [...marks, seed(segmentId)] : marks.filter((m) => m.segmentId !== segmentId));
  const name = (key: RatingKey) => (key === "confidence" ? t("session.confidenceLabel") : t(`rating.${key}`));
  const labels = (key: RatingKey) => [1, 2, 3, 4, 5].map((n) => (key === "confidence" ? t("common.starRating", { count: n }) : t(`rating.${key}.${n}`)));
  const applyToOthers = (from: SegmentMark) => {
    const before = marks;
    onChange(marks.map((m) => (m === from ? m : { ...m, mood: from.mood, focus: from.focus, confidence: from.confidence })));
    toast(t("rating.applied"), { action: { label: t("common.undo"), onClick: () => onChange(before) } });
  };

  return (
    <div className="divide-y divide-border">
      {rows.map(({ id, label }) => {
        const m = marks.find((x) => x.segmentId === id);
        const missing = m && requireRatings ? missingRatings(m) : [];
        const others = m ? marks.filter((x) => x !== m) : [];
        const replaces = m ? others.filter((x) => RATING_KEYS.some((k) => x[k] !== undefined && x[k] !== m[k])).length : 0;
        return (
          <section key={id ?? "whole"} aria-label={label || undefined} className="space-y-4 py-5 first:pt-0 last:pb-0">
            {id !== undefined && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-serif text-lg font-semibold leading-tight">{label}</h3>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <Switch checked={!!m} onCheckedChange={(on) => setStudied(id, on)} aria-label={`${label}: ${t("rating.studied")}`} />
                  {m ? t("rating.studied") : t("rating.notStudied")}
                </label>
              </div>
            )}
            {m && (
              <>
                {missing.length > 0 && <p className="text-xs font-medium text-destructive">{t("rating.missing", { fields: missing.map(name).join(", ") })}</p>}
                <div className="grid gap-4 sm:grid-cols-3">
                  {RATING_KEYS.map((key) => (
                    <RatingScale key={key} label={name(key)} question={t(`rating.${key}Question`)} labels={labels(key)} value={m[key]}
                      onChange={(value) => patch(id, { [key]: value } as Partial<SegmentMark>)} unanswered={t("rating.unanswered")} required={requireRatings} />
                  ))}
                </div>
                {others.length > 0 && missingRatings(m).length === 0 && (
                  <div className="space-y-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => applyToOthers(m)}>{t("rating.applyToOthers")}</Button>
                    {replaces > 0 && <p className="text-xs text-muted-foreground">{t("rating.applyReplaces", { count: replaces })}</p>}
                  </div>
                )}
                {!isTheory && <BpmCoupler bpm={m.bpm} noteVal={m.noteVal} onChange={({ bpm, noteVal }) => patch(id, { bpm, noteVal })} label={t("session.bpmReached")} />}
                <details open={isTheory} className="border-t border-border pt-3">
                  <summary className="cursor-pointer list-none text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground">
                    {t("session.workedOn", { layers: m.layers.length, techniques: m.techniques.length })}
                  </summary>
                  <div className="mt-3 space-y-4">
                    <MultiChipPicker label={t("session.layers")} options={layerOptions} value={m.layers} onChange={(layers) => patch(id, { layers })} />
                    <MultiChipPicker label={t("session.techniquesPracticed")} options={techniqueOptions} value={m.techniques} onChange={(techniques) => patch(id, { techniques })} />
                  </div>
                </details>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 11: Log page — task and free flows**

In `src/pages/SessionLogPage.tsx`:

1. Imports: add `useEffect` to the React import; add `emptyEntry` to the `@/domain/logic/plan` import; add `import { missingRatings } from "@/domain/logic/sessionMetrics";`; replace `sessionInputSchema` with `newSessionInputSchema` in the `@/lib/schemas` import; add `import type { SessionTarget } from "@/domain/ports/session";`.
2. Replace `markErrors`:

```ts
/** Blocking problems of a new session: something studied, every studied section fully rated, valid fields. */
const markErrors = (notes: string, marks: SegmentMark[], t: ReturnType<typeof useI18n>["t"]) => {
  if (!marks.length) return [t("rating.pickStudied")];
  const unrated = marks.filter((m) => missingRatings(m).length > 0).length;
  if (unrated) return [t("rating.missingSummary", { count: unrated })];
  return flattenErrors(newSessionInputSchema.safeParse({ notes, marks }));
};
```

   and pass `t` at both call sites: `markErrors(notes, cleanMarks(marks, isTheory), t)`.
3. `TaskSessionForm`: keep a row for every planned section even if the library segment was deleted, and seed newly ticked rows from the plan:

```tsx
  const rows = planSegmentIds(task.plan).map((id) => ({ id, label: sections?.find((s) => s.id === id)?.label ?? "—" }));
  const seed = (id: number) => marksFromPlan(task.plan).find((m) => m.segmentId === id) ?? emptyEntry(id);
```

   and render `<MarksEditor marks={marks} onChange={changeMarks} sections={rows} seed={seed} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} />`.
4. `FreeSessionForm`: offer the item's sections, reset marks when the item changes, hide the subject select when there is only one subject, and save without any task:

```tsx
  const itemSegments = usePresentationRead<Segment[]>("library.segments", [itemId]);
  // A piece with sections starts with none ticked; anything else is one whole-scope entry.
  useEffect(() => { setMarks(itemSegments?.length ? [] : [emptyEntry()]); }, [itemId, itemSegments?.length]);
```

```tsx
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length || busy || subjId === undefined) return;
    setBusy(true);
    try {
      const target: SessionTarget = { subjectId: subjId, linkType: itemId ? "item" : "free", itemId, title: item?.title ?? (title.trim() || t("diary.freeSession")), plan: [] };
      await applicationCommands.sessions.log.execute(target, { date, notes, marks: cleanMarks(marks, isTheory), helpText: needHelp && itemId ? helpText.trim() : undefined });
      toast.success(t("toast.sessionLogged"));
      goBack();
    } catch (err) {
      toast.error((err as Error).message || t("errors.couldNotSave"));
      setBusy(false);
    }
  };
```

   Wrap the subject `<label>…<select>…</label>` in `{(subjects?.length ?? 0) > 1 && ( … )}` and render `<MarksEditor marks={marks} onChange={setMarks} sections={itemSegments?.map((s) => ({ id: s.id, label: s.label }))} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} />`.

- [ ] **Step 12: Session page — context from the session, lenient edit, ratings shown**

In `src/pages/SessionPage.tsx`:

1. Reads: `usePresentationRead<LibraryItem | undefined>("library.item", [session.itemId])`, `usePresentationRead<Subject | undefined>("subjects.one", [session.subjectId])`; filter `techniqueOptions` by `x.subjectId === session.subjectId`; the item link uses `session.itemId`. Keep the `tasks.one` read only for the title fallback.
2. Imports: `RATING_KEYS` from `@/domain/entities/common`, `emptyEntry` from `@/domain/logic/plan`.
3. Errors: after `const e = date ? [] : [t("session.dateRequired")];` add `if (!marks.length) e.push(t("rating.pickStudied"));` (schema stays the lenient `sessionInputSchema`).
4. Edit form: `<MarksEditor marks={marks} onChange={setMarks} sections={sections} seed={(id) => emptyEntry(id)} layerOptions={layerOptions} techniqueOptions={techniqueOptions} isTheory={isTheory} requireRatings={false} />`.
5. Save keeps the planned-but-not-studied list in step with the edit:

```ts
    const studied = new Set(marks.map((m) => m.segmentId));
    const notStudied = session.taskId === undefined ? [] : sections.map((s) => s.id).filter((id) => !studied.has(id));
    await sessionsService.update(session.id, { date, notes: notes.trim() || undefined, marks, notStudied: notStudied.length ? notStudied : undefined });
```

6. View list: replace the confidence span with all three ratings and list the sections not studied:

```tsx
                      {RATING_KEYS.map((key) => (
                        <span key={key}>{key === "confidence" ? t("session.confidenceLabel") : t(`rating.${key}`)} {m[key] ?? "—"}</span>
                      ))}
```

```tsx
              {!!session.notStudied?.length && (
                <p className="mt-3 text-sm text-muted-foreground">{t("rating.notStudied")}: {session.notStudied.map((id) => sections.find((s) => s.id === id)?.label ?? "—").join(", ")}</p>
              )}
```

   (the second block right after the `</ul>` of the measures section). Remove the now-unused `confidenceLabel` import.

- [ ] **Step 13: One-tap completion no longer invents a session**

A one-tap "done" used to save an unrated session, which the new invariant forbids. It now only marks the task done and offers to log results.

Replace `src/components/diary/CompletionBar.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/domain/entities/task";
import { useI18n } from "@/lib/i18n";
import { helpRequestsService } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const START_MS = 6000;
const BUMP_MS = 3000;
const TICK_MS = 100;

/** Shown after a one-tap completion. The task is only marked done: results are logged on the log page, never invented here. */
export function CompletionBar({ task, onClose, onUndo, onLog }: { task: Task; onClose: () => void; onUndo: () => void; onLog: () => void }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [writing, setWriting] = useState(false);
  const [left, setLeft] = useState(START_MS);
  const peak = useRef(START_MS);

  useEffect(() => {
    if (writing) return;
    const id = setInterval(() => setLeft((l) => l - TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [writing]);
  useEffect(() => {
    peak.current = Math.max(peak.current, left);
    if (left <= 0) onClose();
  }, [left, onClose]);

  const ask = async () => {
    const text = question.trim();
    if (!text || task.itemId === undefined) return;
    await helpRequestsService.add(task.itemId, text);
    setQuestion("");
    setLeft((l) => l + BUMP_MS);
    toast.success(t("rate.asked"));
  };

  return (
    <div
      role="region"
      aria-label={t("rate.region")}
      className={cn(
        "fixed inset-x-3 z-[60] grid max-w-[760px] gap-3 overflow-hidden rounded-[14px] border border-border bg-card p-4 shadow-raised",
        "bottom-[calc(84px+env(safe-area-inset-bottom))] min-[700px]:bottom-5 min-[700px]:left-[calc(195px+2rem)] min-[700px]:right-8",
        "min-[1151px]:left-[calc(208px+2rem)] min-[1600px]:left-[calc(250px+2rem)] motion-safe:animate-fade-in",
      )}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-secondary">
        <div className="h-full origin-left bg-primary" style={{ transform: `scaleX(${Math.max(0, left) / peak.current})` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm"><strong className="font-semibold">{t("rate.completed", { title: task.title })}</strong></span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline" aria-live="off">
            {writing ? t("rate.paused") : t("rate.closesIn", { s: Math.ceil(left / 1000) })}
          </span>
          <Button size="sm" variant="outline" onClick={onUndo}>{t("common.undo")}</Button>
          <Button size="icon" variant="ghost" className="h-11 w-11" aria-label={t("common.close")} onClick={onClose}><X /></Button>
        </span>
      </div>
      <button type="button" onClick={onLog} className="inline-flex w-fit items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
        {t("rate.logResults")} <ChevronRight className="h-4 w-4" />
      </button>
      {task.itemId !== undefined && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} aria-label={t("rate.question")} placeholder={t("rate.question")}
            onFocus={() => setWriting(true)} onBlur={() => setWriting(false)} />
          <Button type="submit" size="sm" variant="outline" className="h-[42px]" disabled={!question.trim()}>{t("rate.ask")}</Button>
        </form>
      )}
    </div>
  );
}
```

In `src/pages/Diary.tsx`: remove the `unratedMarks` import; add `remainingSegmentIds` to the `@/domain/logic/plan` import; replace the `rated` state and the `complete` / `undoComplete` functions with:

```ts
  const [completed, setCompleted] = useState<Task | null>(null);
  // One-tap completion marks the task done; results are logged separately and never invented.
  const complete = async (task: Task) => {
    try {
      await tasksService.toggleDone(task.id!, true);
      setCompleted(task);
    } catch {
      toast.error(t("rate.failed"));
    }
  };
  const undoComplete = async () => {
    if (!completed?.id) return;
    const task = completed;
    setCompleted(null);
    await tasksService.toggleDone(task.id!, false);
    toast(t("toast.taskReopened"));
  };
```

replace the `<CompletionBar … />` mount with:

```tsx
      {completed && (
        <CompletionBar
          key={completed.id}
          task={completed}
          onClose={() => setCompleted(null)}
          onUndo={() => void undoComplete()}
          onLog={() => { const id = completed.id; setCompleted(null); navigate(`/log?task=${id}`); }}
        />
      )}
```

replace the bulk-complete action body with `runBulk(async (items) => { await tasksService.bulkSetDone(items.filter((x) => !x.done).flatMap((x) => (x.id === undefined ? [] : [x.id])), true); }, "diary.bulkDone")`, and in the task row (right after `const last = sess[sess.length - 1];`) add `const left = !task.done && sess.length ? remainingSegmentIds(task.plan, sess).length : 0;`, rendering `{left > 0 && <span className="text-xs text-muted-foreground">{t("diary.remaining", { count: left })}</span>}` in the row's meta line (next to the existing last-session text).

- [ ] **Step 14: Remaining readers of `session.taskId`**

`src/pages/History.tsx`: add `const taskOf = (s: Session) => (s.taskId === undefined ? undefined : taskById.get(s.taskId));`, replace every `taskById.get(s.taskId)` with `taskOf(s)`, and every `task?.subjectId` / `task?.itemId` / `task?.collectionId` / `task.subjectId` read on a session with `s.subjectId` / `s.itemId` / `s.collectionId`. In the grouping: `const segIds = s.marks.flatMap((m) => (m.segmentId === undefined ? [] : [m.segmentId]));`, and for `case "task"`: `key = \`t:${s.taskId ?? \`s${s.id}\`}\`; label = task?.title ?? s.snapshot?.taskTitle ?? t("history.untitled");`. Check with `grep -n "taskById.get(s.taskId)\|task?.subjectId\|task?.itemId" src/pages/History.tsx` → no output.

`src/pages/PrintSummary.tsx`: `return all.filter((session) => session.subjectId === subjectId);` and in `pieces`: `const item = session.itemId !== undefined ? itemById.get(session.itemId) : undefined; const title = item?.title ?? session.snapshot?.taskTitle ?? t("history.untitled");` — drop `taskById`/`useAllTasks` if they become unused.

`src/lib/sampleData.ts`: add `import { sessionContext } from "@/domain/logic/sessionContext";` and spread `...sessionContext(fullTask),` into each of the three `db.sessions.add({ … })` objects (for the first one, whose task variable is `fullTask` too, place it right after `taskId: id,`).

- [ ] **Step 15: Strings and product docs**

Run (adds the keys to all four dictionaries, keeping file format):

```bash
node - <<'EOF'
const fs = require("fs");
const add = {
  it: {
    "rating.mood": "Umore", "rating.focus": "Concentrazione",
    "rating.moodQuestion": "Come ti sei sentito lavorando su questo passaggio?",
    "rating.focusQuestion": "Quanto sei riuscito a restare concentrato?",
    "rating.confidenceQuestion": "Quanto ti senti sicuro nell'esecuzione?",
    "rating.mood.1": "Molto negativo", "rating.mood.2": "Negativo", "rating.mood.3": "Neutro", "rating.mood.4": "Positivo", "rating.mood.5": "Molto positivo",
    "rating.focus.1": "Molto bassa", "rating.focus.2": "Bassa", "rating.focus.3": "Media", "rating.focus.4": "Alta", "rating.focus.5": "Molto alta",
    "rating.unanswered": "Non risposto", "rating.missing": "Mancano: {{fields}}",
    "rating.missingSummary": "Completa le valutazioni di {{count}} sezione", "rating.missingSummary_plural": "Completa le valutazioni di {{count}} sezioni",
    "rating.applyToOthers": "Applica questi valori agli altri segmenti",
    "rating.applyReplaces": "Sostituisce {{count}} risposta già data", "rating.applyReplaces_plural": "Sostituisce {{count}} risposte già date",
    "rating.applied": "Valori applicati", "rating.studied": "Studiato", "rating.notStudied": "Non studiato",
    "rating.pickStudied": "Seleziona almeno una sezione studiata",
    "diary.remaining": "{{count}} sezione da studiare", "diary.remaining_plural": "{{count}} sezioni da studiare",
    "rate.logResults": "Registra i risultati"
  },
  en: {
    "rating.mood": "Mood", "rating.focus": "Focus",
    "rating.moodQuestion": "How did working on this passage feel?",
    "rating.focusQuestion": "How well did you stay focused?",
    "rating.confidenceQuestion": "How secure do you feel playing it?",
    "rating.mood.1": "Very negative", "rating.mood.2": "Negative", "rating.mood.3": "Neutral", "rating.mood.4": "Positive", "rating.mood.5": "Very positive",
    "rating.focus.1": "Very low", "rating.focus.2": "Low", "rating.focus.3": "Medium", "rating.focus.4": "High", "rating.focus.5": "Very high",
    "rating.unanswered": "Not answered", "rating.missing": "Missing: {{fields}}",
    "rating.missingSummary": "Answer the ratings of {{count}} section", "rating.missingSummary_plural": "Answer the ratings of {{count}} sections",
    "rating.applyToOthers": "Apply these values to the other sections",
    "rating.applyReplaces": "Replaces {{count}} existing answer", "rating.applyReplaces_plural": "Replaces {{count}} existing answers",
    "rating.applied": "Values applied", "rating.studied": "Studied", "rating.notStudied": "Not studied",
    "rating.pickStudied": "Pick at least one section you studied",
    "diary.remaining": "{{count}} section left", "diary.remaining_plural": "{{count}} sections left",
    "rate.logResults": "Log results"
  },
  es: {
    "rating.mood": "Estado de ánimo", "rating.focus": "Concentración",
    "rating.moodQuestion": "¿Cómo te sentiste trabajando en este pasaje?",
    "rating.focusQuestion": "¿Cuánto lograste mantener la concentración?",
    "rating.confidenceQuestion": "¿Qué tan seguro te sientes al ejecutarlo?",
    "rating.mood.1": "Muy negativo", "rating.mood.2": "Negativo", "rating.mood.3": "Neutro", "rating.mood.4": "Positivo", "rating.mood.5": "Muy positivo",
    "rating.focus.1": "Muy baja", "rating.focus.2": "Baja", "rating.focus.3": "Media", "rating.focus.4": "Alta", "rating.focus.5": "Muy alta",
    "rating.unanswered": "Sin respuesta", "rating.missing": "Faltan: {{fields}}",
    "rating.missingSummary": "Completa las valoraciones de {{count}} sección", "rating.missingSummary_plural": "Completa las valoraciones de {{count}} secciones",
    "rating.applyToOthers": "Aplicar estos valores a los demás segmentos",
    "rating.applyReplaces": "Sustituye {{count}} respuesta ya dada", "rating.applyReplaces_plural": "Sustituye {{count}} respuestas ya dadas",
    "rating.applied": "Valores aplicados", "rating.studied": "Estudiado", "rating.notStudied": "No estudiado",
    "rating.pickStudied": "Selecciona al menos una sección estudiada",
    "diary.remaining": "Queda {{count}} sección", "diary.remaining_plural": "Quedan {{count}} secciones",
    "rate.logResults": "Registrar resultados"
  },
  de: {
    "rating.mood": "Stimmung", "rating.focus": "Konzentration",
    "rating.moodQuestion": "Wie hast du dich bei diesem Abschnitt gefühlt?",
    "rating.focusQuestion": "Wie gut konntest du dich konzentrieren?",
    "rating.confidenceQuestion": "Wie sicher fühlst du dich beim Spielen?",
    "rating.mood.1": "Sehr negativ", "rating.mood.2": "Negativ", "rating.mood.3": "Neutral", "rating.mood.4": "Positiv", "rating.mood.5": "Sehr positiv",
    "rating.focus.1": "Sehr niedrig", "rating.focus.2": "Niedrig", "rating.focus.3": "Mittel", "rating.focus.4": "Hoch", "rating.focus.5": "Sehr hoch",
    "rating.unanswered": "Nicht beantwortet", "rating.missing": "Fehlt: {{fields}}",
    "rating.missingSummary": "Bewertungen für {{count}} Abschnitt ergänzen", "rating.missingSummary_plural": "Bewertungen für {{count}} Abschnitte ergänzen",
    "rating.applyToOthers": "Diese Werte auf die anderen Abschnitte anwenden",
    "rating.applyReplaces": "Ersetzt {{count}} vorhandene Antwort", "rating.applyReplaces_plural": "Ersetzt {{count}} vorhandene Antworten",
    "rating.applied": "Werte übernommen", "rating.studied": "Geübt", "rating.notStudied": "Nicht geübt",
    "rating.pickStudied": "Wähle mindestens einen geübten Abschnitt",
    "diary.remaining": "Noch {{count}} Abschnitt", "diary.remaining_plural": "Noch {{count}} Abschnitte",
    "rate.logResults": "Ergebnisse eintragen"
  },
};
const drop = ["rate.note", "rate.noteLabel", "rate.more", "rate.bpmDown", "rate.bpmUp"];
for (const [lang, keys] of Object.entries(add)) {
  const path = `src/lib/language/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const key of drop) delete dict[key];
  fs.writeFileSync(path, JSON.stringify(Object.assign(dict, keys), null, 2) + "\n");
}
EOF
```

Before running, confirm the dropped keys are unused elsewhere: `grep -rn "rate\.\(note\|noteLabel\|more\|bpmDown\|bpmUp\)\"" src --include=*.tsx --include=*.ts` must print nothing after Step 13, except possibly `src/lib/i18n.test.ts` — remove a dropped key from its critical-keys list if it appears there.

`PRODUCT.md` → under "Capabilities and Constraints" replace "- Not in production yet: the data model may change and existing data may be wiped." with "- Migrations preserve data: no wipe shortcuts." and "- Confidence is the only per-section rating (1-5); no quality scale, no per-layer or per-technique scores." with "- Three per-section ratings (1-5): mood, focus, confidence. Mood and focus are context only; confidence alone feeds routine weighting. No quality scale, no per-layer or per-technique scores." `CLAUDE.md` → after "v13 reshaped tasks/sessions/assignments and clears pre-release data." append " v14 back-fills session subject/content references and wipes nothing."

- [ ] **Step 16: Full verification**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint`
Expected: tsc clean; all tests pass (348 baseline + the new ones); lint shows no new errors (2 pre-existing errors in untouched files are known).

Manual (dev server `npm run dev`, Playwright or browser at 390 px and 1440 px): plan a task with 3 sections → log 2 sections → task stays open with "1 sezione da studiare"; log the third → done. Log a free session with no item and with a sectioned item; History lists both. Try saving with one rating missing → the section shows "Mancano: …" and the save button is disabled. Keyboard: Tab reaches every rating button, Space/Enter selects, screen-reader names read "4 — Positivo".

- [ ] **Step 17: Commit**

```bash
git add src/domain/entities/common.ts src/domain/entities/session.ts src/domain/logic/sessionContext.ts src/domain/logic/plan.ts src/domain/logic/sessionMetrics.ts src/domain/logic/progress.ts src/domain/logic/progress.test.ts src/domain/ports/session.ts src/domain/ports/task.ts src/domain/domain-boundaries.test.ts src/lib/schemas.ts src/application/useCases/logSession.ts src/application/useCases/taskSession.test.ts src/infrastructure/dexie/db.ts src/infrastructure/dexie/migration.test.ts src/infrastructure/dexie/presentationReadPort.ts src/infrastructure/repositories/dexie/sessionRepository.ts src/infrastructure/repositories/dexie/taskRepository.ts src/infrastructure/repositories/dexie/studyRoutineRepository.ts src/infrastructure/repositories/dexie/repositories.test.ts src/presentation/hooks/useReadiness.ts src/components/shared/RatingScale.tsx src/components/shared/StarRating.tsx src/components/diary/MarksEditor.tsx src/components/diary/CompletionBar.tsx src/pages/SessionLogPage.tsx src/pages/SessionPage.tsx src/pages/Diary.tsx src/pages/History.tsx src/pages/PrintSummary.tsx src/lib/sampleData.ts src/lib/language/it.json src/lib/language/en.json src/lib/language/es.json src/lib/language/de.json src/test/fakes/FakeSessionRepository.ts src/test/fakes/FakeTaskRepository.ts src/lib/i18n.test.ts PRODUCT.md CLAUDE.md
git commit -m "feat: per-section mood/focus/confidence, task-optional sessions, coverage completion"
```

---

### Task 2: Opt-in plan updates, protected customizations, simple routines

Covers spec §7 and §9 (save never transfers; «Aggiorna la prossima attività»; «Riparti da questi valori»; traceable adaptive regeneration).

**Files:**
- Modify: `src/domain/entities/task.ts`, `src/domain/logic/plan.ts`, `src/domain/logic/plan.test.ts`
- Modify: `src/infrastructure/repositories/dexie/studyRoutineRepository.ts`, `src/infrastructure/repositories/dexie/repositories.test.ts`
- Create: `src/components/diary/UpdateNextTaskPanel.tsx`
- Delete: `src/components/diary/CarryForwardPicker.tsx`
- Modify: `src/pages/SessionLogPage.tsx`, `src/pages/SessionPage.tsx`, `src/pages/EditTaskPage.tsx`, `src/components/diary/LastSessionStrip.tsx`, `src/components/diary/RoutineBuilder.tsx`
- Modify: `src/lib/language/{it,en,es,de}.json`

**Interfaces:**
- Consumes: `Session` (with `subjectId`, `itemId`, `collectionId`, `snapshot.segments`), `followUpTasks`, `entryFor`, `LogSessionUseCase` returning the session id, `collectRoutineWarnings` (`src/lib/domain/studyRoutineGenerator.ts`).
- Produces:
  - `Task.customized?: boolean` — hand-edited routine task; regeneration keeps it.
  - `carryMarksToPlan(plan: SegmentEntry[], marks: SegmentMark[], picks: { tempo: Set<number | undefined>; extras: boolean }): SegmentEntry[]`
  - `tempoProposal(plan: SegmentEntry[], marks: SegmentMark[]): (number | undefined)[]`
  - `restartFrom(marks: SegmentMark[], previous: SegmentMark[]): SegmentMark[]`
  - `<UpdateNextTaskPanel session={Session} />`
  - `<LastSessionStrip task compact? onRestart?: (marks: SegmentMark[]) => void />`

- [ ] **Step 1: Write the failing tests**

In `src/domain/logic/plan.test.ts`, change the import to `import { carryMarksToPlan, followUpTasks, restartFrom, sharesSection, syncPlan, tempoProposal } from "./plan";` and replace the `describe("carryMarksToPlan", …)` block with:

```ts
describe("carryMarksToPlan", () => {
  const next = [e(1, 60), e(2, 70)];
  const marks = [
    { ...e(1, 84), noteVal: "dotted-quarter" as const, layers: ["rhythm"], techniques: [3], confidence: 4, mood: 2, focus: 5 },
    { segmentId: 2, layers: [], techniques: [], confidence: 3 },
  ];

  it("changes only the picked tempos and never copies ratings", () => {
    const out = carryMarksToPlan(next, marks, { tempo: new Set([1]), extras: false });
    expect(out[0]).toEqual({ segmentId: 1, bpm: 84, noteVal: "dotted-quarter", layers: [], techniques: [] });
    expect(out[1]).toEqual(next[1]);
  });

  it("keeps the planned tempo when none was reached and copies layers only on request", () => {
    const out = carryMarksToPlan(next, marks, { tempo: new Set([1, 2]), extras: true });
    expect(out[1]).toEqual({ segmentId: 2, bpm: 70, layers: [], techniques: [] });
    expect(out[0]).toMatchObject({ layers: ["rhythm"], techniques: [3] });
  });

  it("proposes only sections whose reached tempo differs", () => {
    expect(tempoProposal(next, marks)).toEqual([1]);
    expect(sharesSection(next, marks)).toBe(true);
    expect(sharesSection([e(9, 1)], marks)).toBe(false);
  });
});

describe("restartFrom", () => {
  it("copies musical parameters of the last result and no rating", () => {
    const out = restartFrom([{ segmentId: 1, layers: [], techniques: [] }], [{ ...e(1, 90), layers: ["LH"], techniques: [2], confidence: 5, mood: 1, focus: 1 }]);
    expect(out).toEqual([{ segmentId: 1, bpm: 90, layers: ["LH"], techniques: [2] }]);
  });
});
```

In `src/infrastructure/repositories/dexie/repositories.test.ts` append:

```ts
  it("regeneration keeps customized future tasks and does not duplicate their slot", async () => {
    const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
    const itemId = await db.library.add({ subjectId, kind: "repertoire", title: "Sonata", createdAt: 1 });
    const id = await studyRoutineRepository.create({
      subjectId, groups: [{ id: "g", name: "G", pool: [{ type: "item", id: itemId }] }], matrix: { "1": { g: 1 } },
      weeksAhead: 1, repetitionCap: 1, adaptivity: "uniform", startDate: "2030-01-07",
    });
    const [task] = await db.tasks.where("studyRoutineId").equals(id).toArray();
    await db.tasks.update(task.id!, { customized: true, plan: [{ layers: ["edited"], techniques: [] }] });

    await studyRoutineRepository.regenerateFromDate((await db.studyRoutines.get(id))!, "2030-01-07");

    const after = await db.tasks.where("studyRoutineId").equals(id).toArray();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: task.id, customized: true, plan: [{ layers: ["edited"] }] });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/domain/logic/plan.test.ts src/infrastructure/repositories/dexie/repositories.test.ts`
Expected: FAIL — `tempoProposal`/`restartFrom` not exported, `carryMarksToPlan` copies layers, regeneration deletes the customized task (`after[0].customized` undefined).

- [ ] **Step 3: Implement plan helpers and protected regeneration**

`src/domain/entities/task.ts` — add to `Task`:

```ts
  /** Edited by hand after a routine generated it; regeneration keeps it. */
  customized?: boolean;
```

`src/domain/logic/plan.ts` — replace `carryMarksToPlan` and add the two helpers:

```ts
/** Plan entries updated from `marks` only where the user picked it; a missing reached tempo keeps the planned one. Ratings never carry. */
export const carryMarksToPlan = (plan: SegmentEntry[], marks: SegmentMark[], picks: { tempo: Set<number | undefined>; extras: boolean }): SegmentEntry[] =>
  plan.map((e) => {
    const m = entryFor(marks, e.segmentId);
    if (!m) return e;
    const tempo = picks.tempo.has(e.segmentId) && m.bpm !== undefined;
    return {
      segmentId: e.segmentId,
      bpm: tempo ? m.bpm : e.bpm,
      noteVal: tempo ? m.noteVal ?? e.noteVal : e.noteVal,
      layers: picks.extras ? [...m.layers] : e.layers,
      techniques: picks.extras ? [...m.techniques] : e.techniques,
    };
  });

/** Sections where a tempo was reached that differs from the plan: the default proposal of "update next task". */
export const tempoProposal = (plan: SegmentEntry[], marks: SegmentMark[]): (number | undefined)[] =>
  plan.flatMap((e) => {
    const m = entryFor(marks, e.segmentId);
    return m?.bpm !== undefined && (m.bpm !== e.bpm || (m.noteVal ?? e.noteVal) !== e.noteVal) ? [e.segmentId] : [];
  });

/** Current marks restarted from a previous result's tempo, layers and techniques; ratings are never copied. */
export const restartFrom = (marks: SegmentMark[], previous: SegmentMark[]): SegmentMark[] =>
  marks.map((m) => {
    const p = entryFor(previous, m.segmentId);
    return p ? { ...m, bpm: p.bpm, noteVal: p.noteVal, layers: [...p.layers], techniques: [...p.techniques] } : m;
  });
```

`src/infrastructure/repositories/dexie/studyRoutineRepository.ts` — add `import type { Task } from "@/domain/entities/task";`, then:

```ts
const slotKey = (task: Pick<Task, "date" | "itemId" | "collectionId">) => `${task.date}|${task.itemId ?? ""}|${task.collectionId ?? ""}`;
```

change `generate`'s signature to `async function generate(routine: StudyRoutine, fromDate: string, seedCounters?: Map<string, number>, kept: Pick<Task, "date" | "itemId" | "collectionId">[] = [])` and its last line to:

```ts
  // ponytail: a kept task only suppresses the identical draw on its day; a different draw still lands beside it. Make generation slot-aware if days feel crowded.
  const taken = new Set(kept.map(slotKey));
  const fresh = tasks.filter((task) => !taken.has(slotKey(task)));
  if (fresh.length) await db.tasks.bulkAdd(fresh);
```

and in `regenerateFromDate` replace the delete with:

```ts
    const future = await db.tasks.where("studyRoutineId").equals(routine.id).filter((task) => !task.done && task.date >= fromDate).toArray();
    const replaceable = future.filter((task) => !task.customized);
    if (replaceable.length) await db.tasks.bulkDelete(replaceable.map((task) => task.id));
```

and its final call with `await generate(routine, fromDate, counters, future.filter((task) => task.customized));`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/domain/logic/plan.test.ts src/infrastructure/repositories/dexie/repositories.test.ts`
Expected: PASS.

- [ ] **Step 5: Saving no longer transfers; next-task panel; restart; traceable regeneration**

Create `src/components/diary/UpdateNextTaskPanel.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Session } from "@/domain/entities/session";
import { carryMarksToPlan, entryFor, followUpTasks, tempoProposal } from "@/domain/logic/plan";
import { formatDate } from "@/lib/date";
import { tempoLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { tasksService } from "@/lib/services";
import { useActiveTasks } from "@/presentation/hooks/useEntities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** Opt-in carry of a session's musical results to the next matching task, previewed per section; nothing changes before "Apply". */
export function UpdateNextTaskPanel({ session }: { session: Session }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const tasks = useActiveTasks();
  const [picked, setPicked] = useState<(number | undefined)[] | null>(null);
  const [extras, setExtras] = useState(false);
  const next = useMemo(() => followUpTasks(
    { id: session.taskId, date: session.date, subjectId: session.subjectId ?? -1, title: session.snapshot?.taskTitle ?? "", itemId: session.itemId, collectionId: session.collectionId },
    session.marks,
    tasks ?? [],
  )[0], [session, tasks]);
  if (tasks === undefined) return null;

  const heading = <h2 id="next-task" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("nextTask.title")}</h2>;
  if (!next) {
    const segmentIds = session.marks.flatMap((m) => (m.segmentId === undefined ? [] : [m.segmentId]));
    return (
      <section aria-labelledby="next-task" className="space-y-2">
        {heading}
        <p className="text-sm text-muted-foreground">{t("nextTask.none")}</p>
        <Button size="sm" variant="outline" onClick={() => navigate("/tasks/new", { state: { prefill: { subjectId: session.subjectId, itemId: session.itemId, collectionId: session.collectionId, title: session.snapshot?.taskTitle, segmentIds } } })}>
          {t("nextTask.create")}
        </Button>
      </section>
    );
  }

  const tempo = new Set(picked ?? tempoProposal(next.plan, session.marks));
  const labels = new Map((session.snapshot?.segments ?? []).map((s) => [Number(s.id), s.label]));
  const rows = next.plan.flatMap((e) => { const m = entryFor(session.marks, e.segmentId); return m ? [{ e, m }] : []; });
  const toggle = (segmentId: number | undefined, on: boolean) => setPicked([...tempo].filter((id) => id !== segmentId).concat(on ? [segmentId] : []));
  const apply = async () => {
    await tasksService.update(next.id!, { plan: carryMarksToPlan(next.plan, session.marks, { tempo, extras }), ...(next.studyRoutineId !== undefined ? { customized: true } : {}) });
    toast.success(t("nextTask.applied"));
  };

  return (
    <section aria-labelledby="next-task" className="space-y-3">
      {heading}
      <p className="text-sm font-medium">{next.title} · {formatDate(next.date, lang, "medium")}</p>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map(({ e, m }) => (
          <li key={e.segmentId ?? "whole"} className="space-y-1 py-3 text-sm">
            {e.segmentId !== undefined && <div className="font-medium">{labels.get(e.segmentId) ?? "—"}</div>}
            <div className="tabular-nums text-muted-foreground">
              {t("nextTask.planned")}: {e.bpm ? tempoLabel(e.noteVal, e.bpm) : "—"} · {t("nextTask.reached")}: {m.bpm ? tempoLabel(m.noteVal, m.bpm) : "—"}
            </div>
            {m.bpm ? (
              <label className="flex min-h-11 items-center gap-2"><Checkbox checked={tempo.has(e.segmentId)} onCheckedChange={(on) => toggle(e.segmentId, on === true)} />{t("nextTask.useAsTarget")}</label>
            ) : (
              <p className="text-xs text-muted-foreground">{t("nextTask.noTempo")}</p>
            )}
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={extras} onCheckedChange={(on) => setExtras(on === true)} />{t("nextTask.extras")}</label>
      <Button size="sm" disabled={!tempo.size && !extras} onClick={() => void apply()}>{t("nextTask.apply")}</Button>
    </section>
  );
}
```

`src/pages/SessionPage.tsx` — import the panel and render `<div className="mt-8"><UpdateNextTaskPanel session={session} /></div>` at the end of the `<aside>` in view mode.

`src/pages/SessionLogPage.tsx`:

1. Imports: drop `carryMarksToPlan`, `followUpTasks`, `CarryForwardPicker`, `tasksService`; add `restartFrom` to the plan import, `useRef` to React, `useNavigate` is already imported.
2. Add at module level:

```ts
/** Adaptive routines re-plan after a log; the outcome is reported on its own, so a planning failure never touches the saved session. */
async function refreshRoutine(routineId: number, fromDate: string, t: ReturnType<typeof useI18n>["t"], openPlan: () => void): Promise<void> {
  const routine = await presentationQueries().execute<StudyRoutine | undefined>("routines.one", routineId);
  if (!routine || routineAdaptivity(routine) === "uniform") return;
  try {
    await applicationCommands.routines.regenerate.execute(routine, fromDate);
    toast(t("routine.regenerated"), { description: t("routine.regeneratedKept"), action: { label: t("routine.openPlan"), onClick: openPlan } });
  } catch {
    toast.error(t("routine.regenerateFailed"), { action: { label: t("common.retry"), onClick: () => void refreshRoutine(routineId, fromDate, t, openPlan) } });
  }
}
```

3. `TaskSessionForm`: delete `allTasks`, `followUps`, `carryTo`, `carryIds` and the `<CarryForwardPicker … />` line; add `const navigate = useNavigate(); const savedId = useRef<number>();`; the submission command becomes `async ({ input }: { input: SessionLogInput }) => { savedId.current = await applicationCommands.sessions.log.execute(task, input); }`; and after a successful submit the save function ends with:

```ts
    if (task.studyRoutineId) void refreshRoutine(task.studyRoutineId, task.date, t, () => navigate("/tasks?tab=routines"));
    try { localStorage.removeItem(marksDraftKey(task.id)); } catch { /* ignore */ }
    toast.success(t("toast.sessionLogged"), { action: { label: t("nextTask.title"), onClick: () => navigate(`/sessions/${savedId.current}`) } });
    goBack();
```

   Pass the restart action to the strip: `<LastSessionStrip task={task} onRestart={(previous) => changeMarks(restartFrom(marks, previous))} />`.
4. `FreeSessionForm`: keep the returned id (`const id = await applicationCommands.sessions.log.execute(…)`) and use the same `toast.success(…, { action: … navigate(\`/sessions/${id}\`) })`.

Delete `src/components/diary/CarryForwardPicker.tsx`.

`src/components/diary/LastSessionStrip.tsx` — extend `Props` with `onRestart?: (marks: SegmentMark[]) => void` (import `SegmentMark` type), destructure it, and render after the summary line (inside the existing root, only when `lastSession` is loaded):

```tsx
      {onRestart && (
        <button type="button" onClick={() => onRestart(lastSession.marks)} className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-primary hover:underline underline-offset-4">
          {t("logPage.restartFrom")}
        </button>
      )}
```

`src/pages/EditTaskPage.tsx` — in `save`, add to the `tasksService.update(task.id, { … })` object: `...(task.studyRoutineId !== undefined ? { customized: true } : {}),`.

- [ ] **Step 6: Simple routine path on the existing builder**

In `src/components/diary/RoutineBuilder.tsx` (one persisted config backs every view):

1. `const { t, lang } = useI18n();`; import `collectRoutineWarnings` next to `poolEntryKey`, `formatDate` next to `today`, and `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle` from `@/components/ui/alert-dialog`.
2. New routines start with one group and without adaptation:

```ts
  const [groups, setGroups] = useState<StudyGroup[]>(initial?.groups ?? [{ id: genId(), name: t("routine.groupDaily"), pool: [] }]);
  const [adaptivity, setAdaptivity] = useState<Adaptivity>(initial ? routineAdaptivity(initial) : "uniform");
  const [uniformOpen, setUniformOpen] = useState(false);
```

3. Suggested, editable name: after `const subject = …`:

```ts
  const suggestedName = t("routine.suggestedName", { subject: subjects?.find((s) => s.id === subject)?.name ?? "" });
```

   use `placeholder={suggestedName}` on the name input, delete the `!name.trim() && t("studyRoutine.errorNoName")` error, and submit `name: name.trim() || suggestedName`.
4. Regularity, below `const firstDay = activeDays[0];`:

```ts
  const sameRow = (day: number) => groups.every((g) => count(day, g.id) === count(firstDay, g.id));
  const regular = activeDays.length > 0 && activeDays.every(sameRow);
  const single = groups.length === 1 ? groups[0] : undefined;
  const perDay = single && regular ? count(firstDay, single.id) : undefined;
  const setPerDay = (n: number) => single && setMatrix((prev) => ({ ...prev, ...Object.fromEntries(activeDays.map((d) => [String(d), { [single.id]: Math.min(MAX_PER_CELL, Math.max(1, n)) }])) }));
  const uniformChanges = activeDays.filter((d) => !sameRow(d)).map((d) => `${dayName(d)}: ${dayTotal(d)} → ${dayTotal(firstDay)}`);
  const warnings = collectRoutineWarnings({ groups, matrix, repetitionCap: cap });
```

   (move the `dayName` declaration above this block), and make toggling a day reuse the current amount: in `setDayOn`, `on ? 1 : 0` becomes `on ? (perDay ?? 1) : 0`.
5. Right after the study-day chips (the `routine.dayHint` paragraph), add the summary:

```tsx
              {perDay !== undefined ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">{t("routine.perDay")}</span>
                  <span className="inline-flex items-center gap-1">
                    <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={perDay <= 1} aria-label={t("routine.lessOne", { group: single!.name })} onClick={() => setPerDay(perDay - 1)}><Minus /></Button>
                    <output className="w-7 text-center font-numeric text-sm tabular-nums" aria-label={t("routine.perDay")}>{perDay}</output>
                    <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={perDay >= MAX_PER_CELL} aria-label={t("routine.moreOne", { group: single!.name })} onClick={() => setPerDay(perDay + 1)}><Plus /></Button>
                  </span>
                </div>
              ) : regular ? (
                <p className="mt-4 text-sm tabular-nums">{t("routine.perDayFixed", { n: dayTotal(firstDay) })}</p>
              ) : activeDays.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">{t("routine.irregularWeek")}</p>
                  <ul className="text-sm tabular-nums">{activeDays.map((d) => <li key={d}>{dayName(d)}: {dayTotal(d)}</li>)}</ul>
                  <Button type="button" size="sm" variant="outline" onClick={() => setUniformOpen(true)}>{t("routine.uniformize")}</Button>
                </div>
              )}
```

6. Wrap both matrix editors (the mobile day-tabs block and the desktop table, i.e. everything after the summary up to and including the `routine.zeroHint` paragraph) in:

```tsx
              <details open={!regular} className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-primary">{t("routine.customizeWeek")}</summary>
                {/* existing matrix markup, unchanged */}
              </details>
```

   Opening or closing it never touches state.
7. Before the closing `</div>` of the component root add the uniformize confirmation:

```tsx
      <AlertDialog open={uniformOpen} onOpenChange={setUniformOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("routine.uniformize")}</AlertDialogTitle>
            <AlertDialogDescription>{t("routine.uniformizeDesc", { day: firstDay === undefined ? "" : dayName(firstDay) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-sm tabular-nums">{uniformChanges.map((c) => <li key={c}>{c}</li>)}</ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => copyDay(firstDay, activeDays)}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

8. Preview aside: before the `routine.previewMax` paragraph add

```tsx
        {warnings.length > 0 && (
          <ul className="space-y-1 border-t border-border pt-3 text-xs text-destructive">
            {warnings.map((w, i) => (
              <li key={i}>{w.kind === "dayExceedsPool" ? t("routine.warnDayExceedsPool", { day: dayName(w.day ?? 0), group: w.groupName }) : t("routine.warnCapTooLow", { group: w.groupName })}</li>
            ))}
          </ul>
        )}
```

   The options summary shows the defaults explicitly: `{t("routine.optionsSummary", { weeks, cap })} · {t(\`studyRoutine.adaptivity${adaptivity[0].toUpperCase()}${adaptivity.slice(1)}\`)}`. When `isEdit`, above the submit buttons add `<p className="text-xs text-muted-foreground">{t("routine.appliesFrom", { date: formatDate(today(), lang, "medium") })}</p>`.

- [ ] **Step 7: Strings**

```bash
node - <<'EOF'
const fs = require("fs");
const add = {
  it: {
    "nextTask.title": "Aggiorna la prossima attività", "nextTask.planned": "Obiettivo attuale", "nextTask.reached": "Raggiunto",
    "nextTask.useAsTarget": "Usa come nuovo obiettivo", "nextTask.noTempo": "Nessun tempo registrato: resta l'obiettivo pianificato",
    "nextTask.extras": "Copia anche livelli e tecniche", "nextTask.apply": "Applica", "nextTask.applied": "Prossima attività aggiornata",
    "nextTask.none": "Nessuna attività compatibile in programma.", "nextTask.create": "Crea un'attività da questi risultati",
    "logPage.restartFrom": "Riparti da questi valori",
    "routine.regenerated": "Piano della routine aggiornato", "routine.regeneratedKept": "Le attività personalizzate sono state mantenute.",
    "routine.openPlan": "Vedi piano", "routine.regenerateFailed": "Sessione salvata, ma il piano non è stato aggiornato.", "common.retry": "Riprova",
    "routine.perDay": "Elementi per giorno di studio", "routine.perDayFixed": "{{n}} elementi per giorno di studio",
    "routine.customizeWeek": "Personalizza la settimana",
    "routine.irregularWeek": "Settimana personalizzata: quantità diverse tra i giorni.",
    "routine.uniformize": "Uniforma la settimana", "routine.uniformizeDesc": "Ogni giorno di studio prenderà le quantità di {{day}}. Cambiano:",
    "routine.appliesFrom": "Le modifiche si applicano dal {{date}}; attività completate e personalizzate restano invariate.",
    "routine.suggestedName": "Routine di {{subject}}",
    "routine.warnDayExceedsPool": "{{day}}: «{{group}}» chiede più elementi di quanti ne contenga",
    "routine.warnCapTooLow": "«{{group}}»: il limite di ripetizioni non copre la settimana"
  },
  en: {
    "nextTask.title": "Update the next task", "nextTask.planned": "Current target", "nextTask.reached": "Reached",
    "nextTask.useAsTarget": "Use as new target", "nextTask.noTempo": "No tempo logged: the planned target stays",
    "nextTask.extras": "Also copy layers and techniques", "nextTask.apply": "Apply", "nextTask.applied": "Next task updated",
    "nextTask.none": "No matching task planned.", "nextTask.create": "Create a task from these results",
    "logPage.restartFrom": "Start from these values",
    "routine.regenerated": "Routine plan updated", "routine.regeneratedKept": "Customized tasks were kept.",
    "routine.openPlan": "View plan", "routine.regenerateFailed": "Session saved, but the plan was not updated.", "common.retry": "Retry",
    "routine.perDay": "Items per study day", "routine.perDayFixed": "{{n}} items per study day",
    "routine.customizeWeek": "Customize the week",
    "routine.irregularWeek": "Customized week: amounts differ between days.",
    "routine.uniformize": "Even out the week", "routine.uniformizeDesc": "Every study day takes {{day}}'s amounts. Changes:",
    "routine.appliesFrom": "Changes apply from {{date}}; completed and customized tasks stay as they are.",
    "routine.suggestedName": "{{subject}} routine",
    "routine.warnDayExceedsPool": "{{day}}: “{{group}}” asks for more items than it holds",
    "routine.warnCapTooLow": "“{{group}}”: the repetition limit cannot fill the week"
  },
  es: {
    "nextTask.title": "Actualizar la próxima actividad", "nextTask.planned": "Objetivo actual", "nextTask.reached": "Alcanzado",
    "nextTask.useAsTarget": "Usar como nuevo objetivo", "nextTask.noTempo": "Sin tempo registrado: se mantiene el objetivo planificado",
    "nextTask.extras": "Copiar también niveles y técnicas", "nextTask.apply": "Aplicar", "nextTask.applied": "Próxima actividad actualizada",
    "nextTask.none": "No hay ninguna actividad compatible planificada.", "nextTask.create": "Crear una actividad con estos resultados",
    "logPage.restartFrom": "Empezar desde estos valores",
    "routine.regenerated": "Plan de la rutina actualizado", "routine.regeneratedKept": "Se mantuvieron las actividades personalizadas.",
    "routine.openPlan": "Ver plan", "routine.regenerateFailed": "Sesión guardada, pero el plan no se actualizó.", "common.retry": "Reintentar",
    "routine.perDay": "Elementos por día de estudio", "routine.perDayFixed": "{{n}} elementos por día de estudio",
    "routine.customizeWeek": "Personalizar la semana",
    "routine.irregularWeek": "Semana personalizada: las cantidades cambian entre días.",
    "routine.uniformize": "Uniformar la semana", "routine.uniformizeDesc": "Cada día de estudio tomará las cantidades del {{day}}. Cambian:",
    "routine.appliesFrom": "Los cambios se aplican desde el {{date}}; las actividades completadas y personalizadas no cambian.",
    "routine.suggestedName": "Rutina de {{subject}}",
    "routine.warnDayExceedsPool": "{{day}}: «{{group}}» pide más elementos de los que contiene",
    "routine.warnCapTooLow": "«{{group}}»: el límite de repeticiones no cubre la semana"
  },
  de: {
    "nextTask.title": "Nächste Aufgabe aktualisieren", "nextTask.planned": "Aktuelles Ziel", "nextTask.reached": "Erreicht",
    "nextTask.useAsTarget": "Als neues Ziel übernehmen", "nextTask.noTempo": "Kein Tempo erfasst: das geplante Ziel bleibt",
    "nextTask.extras": "Auch Ebenen und Techniken übernehmen", "nextTask.apply": "Übernehmen", "nextTask.applied": "Nächste Aufgabe aktualisiert",
    "nextTask.none": "Keine passende Aufgabe geplant.", "nextTask.create": "Aufgabe aus diesen Ergebnissen erstellen",
    "logPage.restartFrom": "Mit diesen Werten beginnen",
    "routine.regenerated": "Routinenplan aktualisiert", "routine.regeneratedKept": "Angepasste Aufgaben wurden beibehalten.",
    "routine.openPlan": "Plan ansehen", "routine.regenerateFailed": "Sitzung gespeichert, aber der Plan wurde nicht aktualisiert.", "common.retry": "Erneut versuchen",
    "routine.perDay": "Einheiten pro Übungstag", "routine.perDayFixed": "{{n}} Einheiten pro Übungstag",
    "routine.customizeWeek": "Woche anpassen",
    "routine.irregularWeek": "Angepasste Woche: die Mengen unterscheiden sich je Tag.",
    "routine.uniformize": "Woche angleichen", "routine.uniformizeDesc": "Jeder Übungstag übernimmt die Mengen von {{day}}. Änderungen:",
    "routine.appliesFrom": "Änderungen gelten ab {{date}}; erledigte und angepasste Aufgaben bleiben unverändert.",
    "routine.suggestedName": "{{subject}}-Routine",
    "routine.warnDayExceedsPool": "{{day}}: „{{group}}“ verlangt mehr Einheiten, als es enthält",
    "routine.warnCapTooLow": "„{{group}}“: das Wiederholungslimit füllt die Woche nicht"
  },
};
for (const [lang, keys] of Object.entries(add)) {
  const path = `src/lib/language/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(path, "utf8"));
  fs.writeFileSync(path, JSON.stringify(Object.assign(dict, keys), null, 2) + "\n");
}
EOF
```

Then `grep -rn "studyRoutine.errorNoName" src --include=*.tsx` — if empty, delete that key from the four files the same way (`delete dict["studyRoutine.errorNoName"]`).

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint`
Expected: all green (no new lint errors).

Manual: create a routine with 5 exercises, Mon/Wed/Fri, 2 per day → preview shows 6/week and no warning; open and close «Personalizza la settimana» → summary unchanged; set Wed to 3 inside the matrix → summary switches to the irregular list; «Uniforma la settimana» lists "mercoledì: 3 → 2" before confirming. Log a session for a routine task → toast offers «Aggiorna la prossima attività»; the panel proposes only the tempo that changed; apply → the target task shows the new tempo and survives a regeneration (edit the routine and save).

- [ ] **Step 9: Commit**

```bash
git add src/domain/entities/task.ts src/domain/logic/plan.ts src/domain/logic/plan.test.ts src/infrastructure/repositories/dexie/studyRoutineRepository.ts src/infrastructure/repositories/dexie/repositories.test.ts src/components/diary/UpdateNextTaskPanel.tsx src/components/diary/CarryForwardPicker.tsx src/components/diary/LastSessionStrip.tsx src/components/diary/RoutineBuilder.tsx src/pages/SessionLogPage.tsx src/pages/SessionPage.tsx src/pages/EditTaskPage.tsx src/lib/language/it.json src/lib/language/en.json src/lib/language/es.json src/lib/language/de.json
git commit -m "feat: opt-in next-task update, protected customized routine tasks, simple routine path"
```

---

### Task 3: Evidence instead of a readiness percentage; rating trends

Covers spec §10 and the reading part of §4.

**Files:**
- Modify (rewrite): `src/domain/logic/readiness.ts`; Create test: `src/domain/logic/readiness.test.ts`
- Modify: `src/domain/logic/progress.ts`, `src/domain/logic/progress.test.ts`
- Modify: `src/presentation/hooks/useReadiness.ts`
- Modify: `src/pages/Repertoire.tsx`, `src/pages/EventPage.tsx`, `src/pages/ReadinessPage.tsx`
- Modify: `src/components/diary/SegmentHistory.tsx`, `src/components/diary/ProgressDashboard.tsx`
- Modify: `src/lib/language/{it,en,es,de}.json`

**Interfaces:**
- Consumes: `Session` (Task 1), `RATING_KEYS`, `meanRating`, `tempoLabel`, `formatDate`.
- Produces:
  - `interface Tempo { bpm: number; noteVal?: NoteVal; date: string }`
  - `interface SectionEvidence { segmentId?: number; label: string; lastStudied?: string; lastConfidence?: { value: number; date: string }; lastTempo?: Tempo }`
  - `interface PieceEvidence { total; rated; sections: SectionEvidence[]; lastStudied?; toDo: string[]; lowConfidence: string[]; best: Tempo[]; targetBpm? }`
  - `pieceEvidence(item: Pick<LibraryItem,"targetBpm">, segments: Pick<Segment,"id"|"label">[], sessions: Session[]): PieceEvidence`
  - `useReadiness()` returns `{ ready, itemsById, sessionsOf, segmentsOf, evidenceFor(item) }` (`readinessFor` removed)
  - `ProgressWeek.mood: number | null`, `ProgressWeek.focus: number | null`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/logic/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Session } from "../entities/session";
import { pieceEvidence } from "./readiness";

const mk = (id: number, date: string, marks: Session["marks"], createdAt = 1): Session => ({ id, date, marks, createdAt });
const m = (segmentId: number | undefined, extra: Partial<Session["marks"][number]> = {}) => ({ segmentId, layers: [], techniques: [], ...extra });

describe("pieceEvidence", () => {
  it("counts rated sections against the current ones and keeps missing apart from low", () => {
    const segments = [{ id: 1, label: "A" }, { id: 2, label: "B" }, { id: 3, label: "C" }];
    const e = pieceEvidence({ targetBpm: 100 }, segments, [
      mk(1, "2026-10-01", [m(1, { confidence: 2, bpm: 80, noteVal: "quarter" })]),
      mk(2, "2026-10-03", [m(2)]),
      mk(3, "2026-10-03", [m(1, { confidence: 4 })], 2),
      mk(4, "2026-09-01", [m(99, { confidence: 5 })]), // section deleted since: never counted
    ]);
    expect(e).toMatchObject({ total: 3, rated: 1, toDo: ["C"], lowConfidence: [], lastStudied: "2026-10-03", targetBpm: 100 });
    expect(e.sections[0]).toMatchObject({ lastConfidence: { value: 4, date: "2026-10-03" }, lastTempo: { bpm: 80, date: "2026-10-01" } });
    expect(e.sections[1].lastConfidence).toBeUndefined();
    expect(e.sections[1].lastStudied).toBe("2026-10-03");
  });

  it("breaks same-day ties by creation time, then id", () => {
    const e = pieceEvidence({}, [{ id: 1, label: "A" }], [mk(2, "2026-10-01", [m(1, { confidence: 1 })], 5), mk(1, "2026-10-01", [m(1, { confidence: 5 })], 5)]);
    expect(e.sections[0].lastConfidence?.value).toBe(1);
    expect(e.lowConfidence).toEqual(["A"]);
  });

  it("never compares tempi across note values and has no denominator for a whole piece", () => {
    const e = pieceEvidence({}, [], [mk(1, "2026-10-01", [m(undefined, { bpm: 120, noteVal: "eighth" })]), mk(2, "2026-10-02", [m(undefined, { bpm: 70 })])]);
    expect(e.total).toBe(0);
    expect(e.toDo).toEqual([]);
    expect(e.best).toEqual(expect.arrayContaining([{ bpm: 120, noteVal: "eighth", date: "2026-10-01" }, { bpm: 70, noteVal: "quarter", date: "2026-10-02" }]));
    expect(e.sections[0].lastTempo).toMatchObject({ bpm: 70 });
  });
});
```

In `src/domain/logic/progress.test.ts`, add `mood: null, focus: null` to the first `toEqual` expectation and append:

```ts
  it("averages mood and focus per session first, then per week", () => {
    const rated = [
      { taskId: 1, subjectId: 10, date: "2026-10-05", marks: [{ ...entry, mood: 1, focus: 2 }, { ...entry, mood: 1, focus: 2 }, { ...entry, mood: 1, focus: 2 }] },
      { taskId: 1, subjectId: 10, date: "2026-10-06", marks: [{ ...entry, mood: 5, focus: 4 }] },
    ];
    expect(weeklyProgress(rated, tasks, 10, 1, "2026-10-08")[0]).toMatchObject({ mood: 3, focus: 3 });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/domain/logic/readiness.test.ts src/domain/logic/progress.test.ts`
Expected: FAIL — `pieceEvidence` is not exported; `mood`/`focus` missing from `ProgressWeek`.

- [ ] **Step 3: Implement evidence and trend aggregation**

Replace `src/domain/logic/readiness.ts` with:

```ts
/** What the practice log shows about a repertoire piece: coverage, latest results and their dates. Deliberately no score. */
import type { NoteVal } from "../entities/common";
import type { LibraryItem, Segment } from "../entities/library";
import type { Session } from "../entities/session";

export interface Tempo { bpm: number; noteVal?: NoteVal; date: string }

export interface SectionEvidence {
  /** Undefined for a piece tracked as a whole. */
  segmentId?: number;
  label: string;
  lastStudied?: string;
  lastConfidence?: { value: number; date: string };
  lastTempo?: Tempo;
}

export interface PieceEvidence {
  /** Current sections of the piece; 0 means the piece is tracked as a whole. */
  total: number;
  /** Current sections with at least one confidence rating. */
  rated: number;
  sections: SectionEvidence[];
  lastStudied?: string;
  /** Labels of current sections never studied. */
  toDo: string[];
  /** Labels whose latest confidence is 1 or 2 ("" for a whole piece). */
  lowConfidence: string[];
  /** Highest tempo ever logged, one per note value: tempi counted in different note values are never compared. */
  best: Tempo[];
  targetBpm?: number;
}

/** Oldest first; same-day sessions by creation time, then id, so "latest" is stable. */
const chronological = (sessions: Session[]) =>
  [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt || a.id - b.id);

export function pieceEvidence(item: Pick<LibraryItem, "targetBpm">, segments: Pick<Segment, "id" | "label">[], sessions: Session[]): PieceEvidence {
  const ordered = chronological(sessions);
  const evidenceFor = (segmentId: number | undefined, label: string): SectionEvidence => {
    const row: SectionEvidence = { segmentId, label };
    for (const s of ordered) for (const m of s.marks) {
      if (segmentId !== undefined && m.segmentId !== segmentId) continue;
      row.lastStudied = s.date;
      if (m.confidence !== undefined) row.lastConfidence = { value: m.confidence, date: s.date };
      if (m.bpm) row.lastTempo = { bpm: m.bpm, noteVal: m.noteVal, date: s.date };
    }
    return row;
  };
  const sections = segments.length ? segments.map((s) => evidenceFor(s.id, s.label)) : [evidenceFor(undefined, "")];
  const best = new Map<NoteVal, Tempo>();
  for (const s of ordered) for (const m of s.marks) {
    const noteVal = m.noteVal ?? "quarter";
    if (m.bpm && m.bpm > (best.get(noteVal)?.bpm ?? 0)) best.set(noteVal, { bpm: m.bpm, noteVal, date: s.date });
  }
  return {
    total: segments.length,
    rated: segments.length ? sections.filter((r) => r.lastConfidence).length : 0,
    sections,
    lastStudied: ordered.at(-1)?.date,
    toDo: segments.length ? sections.filter((r) => !r.lastStudied).map((r) => r.label) : [],
    lowConfidence: sections.filter((r) => r.lastConfidence && r.lastConfidence.value <= 2).map((r) => r.label),
    best: [...best.values()],
    targetBpm: item.targetBpm,
  };
}
```

`src/domain/logic/progress.ts`:
- `ProgressWeek` gains `/** Average mood 1..5, session means first (null if none rated). */ mood: number | null;` and the same for `focus`.
- Import `RATING_KEYS` from `../entities/common` and `meanRating` from `./sessionMetrics`.
- Accumulator: `{ bpm: null as number | null, confidence: [] as number[], mood: [] as number[], focus: [] as number[], days: new Set<string>(), hit: 0, tracked: 0 }`.
- Replace the confidence push with `for (const key of RATING_KEYS) { const value = meanRating(marks, key); if (value) a[key].push(value); }` and add the comment `// Session first, then week: a task with many sections weighs as one observation.`
- Return with `const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((x, y) => x + y, 0) / xs.length) * 100) / 100 : null);` → `confidence: avg(a.confidence), mood: avg(a.mood), focus: avg(a.focus)`.

`src/presentation/hooks/useReadiness.ts` — import `pieceEvidence` instead of `calculateReadiness`, drop `today`, and replace `readinessFor` with `evidenceFor: (item: LibraryItem) => pieceEvidence(item, segmentsOf(item.id), sessionsOf(item.id)),`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/domain/logic`
Expected: PASS.

- [ ] **Step 5: Views show evidence, not percentages**

Shared formatting in each view (declare inside the component):

```ts
  const coverage = (ev: PieceEvidence) => [
    ev.total ? t("evidence.rated", { rated: ev.rated, total: ev.total }) : t("evidence.whole"),
    ev.lastStudied ? t("evidence.lastStudied", { date: formatDate(ev.lastStudied, lang, "dayMonth") }) : t("evidence.never"),
  ].join(" · ");
```

(`import type { PieceEvidence } from "@/domain/logic/readiness";`.)

`src/pages/Repertoire.tsx`:
- `const { itemsById, evidenceFor } = useReadiness();`; `const ev = evidenceFor(item);` in the item loop, and replace the readiness `<div className="space-y-1">…<Progress …/></div>` with:

```tsx
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {coverage(ev)}{ev.toDo.length ? ` · ${t("evidence.programmeToDo", { count: ev.toDo.length })}` : ""}
                  </p>
```

- Event rows: replace `scores`/`overall` with

```ts
              const pieces = (links ?? []).filter((link) => link.eventId === event.id).flatMap((link) => {
                const item = itemsById.get(link.itemId);
                return item ? [evidenceFor(item)] : [];
              });
              const toDo = pieces.reduce((sum, ev) => sum + ev.toDo.length, 0);
```

  use `pieces.length` where `scores.length` was, and replace the `<Progress …/>` + `%` span with `<span className="tabular-nums">{t("evidence.programmeToDo", { count: toDo })}</span>`. Remove the `Progress` import.

`src/pages/EventPage.tsx`:
- `const { ready, itemsById, evidenceFor } = useReadiness();`; rows become `return item ? [{ item, ev: evidenceFor(item) }] : [];` sorted by open points: `rows.sort((a, b) => (b.ev.toDo.length + b.ev.lowConfidence.length) - (a.ev.toDo.length + a.ev.lowConfidence.length));`
- Delete `overall`, `metric`, the `SectionHeader` `action`, the whole `event.compare` section and the `Progress` import.
- Row markup:

```tsx
              <li key={item.id} className="grid gap-x-6 gap-y-2 py-4 min-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
                <Link to={`/library/events/${eventId}/item/${item.id}`} className="min-w-0 hover:underline underline-offset-4">
                  <strong className="block break-words font-serif text-xl font-semibold leading-tight">{item.title}</strong>
                  {item.composer && <small className="text-xs italic text-muted-foreground">{item.composer}</small>}
                </Link>
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="tabular-nums">{coverage(ev)}</p>
                  {ev.toDo.length > 0 && <p className="text-muted-foreground">{t("evidence.toDo", { list: ev.toDo.join(", ") })}</p>}
                  {ev.lowConfidence.length > 0 && <p className="font-medium text-destructive">{t("evidence.lowConfidence", { list: ev.lowConfidence.map((l) => l || t("evidence.whole")).join(", ") })}</p>}
                </div>
              </li>
```

`src/pages/ReadinessPage.tsx`:
- `const { ready, itemsById, sessionsOf, evidenceFor } = useReadiness();`, `const ev = evidenceFor(item);`; delete `r`, `spanStart`, `recentCount`, `segmentRows`, the `FREQUENCY_*` import, the percentages `<dl>` and the `drilldown.frequencySources` section.
- Under the header: `<p className="mb-8 text-sm tabular-nums text-muted-foreground">{coverage(ev)}</p>`.
- Sources list now maps `ev.sections` (skip the list when `ev.total === 0`, keep the existing `drilldown.noSegments` paragraph):

```tsx
              {ev.sections.map((s) => (
                <li key={s.segmentId}>
                  <Link to={`/library/item/${itemId}/segment/${s.segmentId}`} aria-label={t("drilldown.openSegmentSessions").replace("{label}", s.label)} className="flex min-h-12 items-center gap-3 py-3 hover:bg-secondary/30">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{s.label}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {s.lastConfidence
                          ? t("drilldown.lastRated").replace("{value}", String(s.lastConfidence.value)).replace("{date}", formatDate(s.lastConfidence.date, lang, "dayMonth"))
                          : s.lastStudied ? t("evidence.noRating") : t("evidence.never")}
                        {s.lastTempo ? ` · ${t("evidence.lastTempo", { tempo: tempoLabel(s.lastTempo.noteVal, s.lastTempo.bpm), date: formatDate(s.lastTempo.date, lang, "dayMonth") })}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
```

- New section after it:

```tsx
        <section>
          <SectionHeader title={t("evidence.best")} />
          <ul className="divide-y divide-border border-t border-border text-sm tabular-nums">
            {ev.best.length === 0 ? <li className="py-3 text-muted-foreground">—</li> : ev.best.map((b) => (
              <li key={b.noteVal} className="py-3">{tempoLabel(b.noteVal, b.bpm)} · {formatDate(b.date, lang, "medium")}</li>
            ))}
          </ul>
          {item.targetBpm ? <p className="mt-2 text-xs text-muted-foreground">{t("evidence.target", { tempo: tempoLabel(item.noteVal, item.targetBpm) })}</p> : null}
        </section>
```

`src/components/diary/SegmentHistory.tsx` — `SectionHeader` for ratings gets `action={<span className="text-xs tabular-nums text-muted-foreground">{t("segment.observations", { count: sessions.length })}</span>}`; each row shows `{m.mood != null && <span className="text-xs tabular-nums text-muted-foreground">{t("rating.mood")} {m.mood}</span>}` and the same for `focus`, next to the confidence label.

`src/components/diary/ProgressDashboard.tsx` — after the confidence chart:

```tsx
      <ChartCard title={t("progress.mood")} data={data} dataKey="mood" kind="line" domain={[1, 5]} />
      <ChartCard title={t("progress.focus")} data={data} dataKey="focus" kind="line" domain={[1, 5]} />
      <p className="text-xs italic text-muted-foreground">{t("progress.contextHint")}</p>
```

- [ ] **Step 6: Strings**

```bash
node - <<'EOF'
const fs = require("fs");
const add = {
  it: {
    "evidence.rated": "{{rated}}/{{total}} sezioni valutate", "evidence.whole": "Brano intero",
    "evidence.lastStudied": "ultimo studio {{date}}", "evidence.never": "mai studiato",
    "evidence.toDo": "Da affrontare: {{list}}", "evidence.lowConfidence": "Sicurezza bassa: {{list}}",
    "evidence.programmeToDo": "{{count}} sezione da affrontare", "evidence.programmeToDo_plural": "{{count}} sezioni da affrontare",
    "evidence.lastTempo": "ultimo tempo {{tempo}} ({{date}})", "evidence.best": "Massimo storico per figura",
    "evidence.target": "Obiettivo: {{tempo}}", "evidence.noRating": "Studiata, sicurezza non registrata",
    "segment.observations": "{{count}} osservazione", "segment.observations_plural": "{{count}} osservazioni",
    "progress.mood": "Umore medio (1–5)", "progress.focus": "Concentrazione media (1–5)",
    "progress.contextHint": "Umore e concentrazione sono contesto: non cambiano preparazione, piano o routine.",
    "event.programmeHint": "Per ogni brano: sezioni valutate, ultimo studio e sezioni da affrontare. Nessun punteggio.",
    "readiness.subtitle": "I dati registrati, con date e valori mancanti."
  },
  en: {
    "evidence.rated": "{{rated}}/{{total}} sections rated", "evidence.whole": "Whole piece",
    "evidence.lastStudied": "last studied {{date}}", "evidence.never": "never studied",
    "evidence.toDo": "Still to tackle: {{list}}", "evidence.lowConfidence": "Low confidence: {{list}}",
    "evidence.programmeToDo": "{{count}} section to tackle", "evidence.programmeToDo_plural": "{{count}} sections to tackle",
    "evidence.lastTempo": "last tempo {{tempo}} ({{date}})", "evidence.best": "All-time best per note value",
    "evidence.target": "Target: {{tempo}}", "evidence.noRating": "Studied, no confidence logged",
    "segment.observations": "{{count}} observation", "segment.observations_plural": "{{count}} observations",
    "progress.mood": "Average mood (1–5)", "progress.focus": "Average focus (1–5)",
    "progress.contextHint": "Mood and focus are context: they never change readiness, plans or routines.",
    "event.programmeHint": "For each piece: rated sections, last study and sections still to tackle. No score.",
    "readiness.subtitle": "What the log holds, with dates and gaps."
  },
  es: {
    "evidence.rated": "{{rated}}/{{total}} secciones valoradas", "evidence.whole": "Obra completa",
    "evidence.lastStudied": "último estudio {{date}}", "evidence.never": "nunca estudiado",
    "evidence.toDo": "Pendientes: {{list}}", "evidence.lowConfidence": "Seguridad baja: {{list}}",
    "evidence.programmeToDo": "{{count}} sección pendiente", "evidence.programmeToDo_plural": "{{count}} secciones pendientes",
    "evidence.lastTempo": "último tempo {{tempo}} ({{date}})", "evidence.best": "Máximo histórico por figura",
    "evidence.target": "Objetivo: {{tempo}}", "evidence.noRating": "Estudiada, sin seguridad registrada",
    "segment.observations": "{{count}} observación", "segment.observations_plural": "{{count}} observaciones",
    "progress.mood": "Ánimo medio (1–5)", "progress.focus": "Concentración media (1–5)",
    "progress.contextHint": "El ánimo y la concentración son contexto: no cambian la preparación, el plan ni las rutinas.",
    "event.programmeHint": "Para cada obra: secciones valoradas, último estudio y secciones pendientes. Sin puntuación.",
    "readiness.subtitle": "Lo que hay en el registro, con fechas y datos faltantes."
  },
  de: {
    "evidence.rated": "{{rated}}/{{total}} Abschnitte bewertet", "evidence.whole": "Ganzes Stück",
    "evidence.lastStudied": "zuletzt geübt {{date}}", "evidence.never": "noch nie geübt",
    "evidence.toDo": "Noch offen: {{list}}", "evidence.lowConfidence": "Geringe Sicherheit: {{list}}",
    "evidence.programmeToDo": "{{count}} offener Abschnitt", "evidence.programmeToDo_plural": "{{count}} offene Abschnitte",
    "evidence.lastTempo": "letztes Tempo {{tempo}} ({{date}})", "evidence.best": "Bestwert je Notenwert",
    "evidence.target": "Ziel: {{tempo}}", "evidence.noRating": "Geübt, keine Sicherheit erfasst",
    "segment.observations": "{{count}} Beobachtung", "segment.observations_plural": "{{count}} Beobachtungen",
    "progress.mood": "Durchschnittliche Stimmung (1–5)", "progress.focus": "Durchschnittliche Konzentration (1–5)",
    "progress.contextHint": "Stimmung und Konzentration sind Kontext: sie ändern weder Vorbereitung noch Plan oder Routinen.",
    "event.programmeHint": "Für jedes Stück: bewertete Abschnitte, letzte Übung und offene Abschnitte. Keine Punktzahl.",
    "readiness.subtitle": "Was das Protokoll enthält, mit Daten und Lücken."
  },
};
const drop = ["performances.readiness", "performances.bpm", "performances.mastery", "performances.frequency", "event.total", "event.compare", "drilldown.frequencySources", "drilldown.frequencyExplain"];
for (const [lang, keys] of Object.entries(add)) {
  const path = `src/lib/language/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const key of drop) delete dict[key];
  fs.writeFileSync(path, JSON.stringify(Object.assign(dict, keys), null, 2) + "\n");
}
EOF
```

Before running, `grep -rn "performances\.\(readiness\|bpm\|mastery\|frequency\)\|event\.\(total\|compare\)\|drilldown\.frequency" src --include=*.tsx --include=*.ts` must print nothing (except `i18n.test.ts`; if a dropped key is in its critical-keys list, remove it there too).

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint && grep -rn "%</\|overall" src/pages/Repertoire.tsx src/pages/EventPage.tsx src/pages/ReadinessPage.tsx`
Expected: green; the grep prints nothing.

Manual: Repertoire, an event and its piece detail at 390 px and 1440 px show "2/5 sezioni valutate · ultimo studio 12 ott", the open sections, and no percentage or progress bar. Progress tab shows mood and focus charts with the context hint.

- [ ] **Step 8: Commit**

```bash
git add src/domain/logic/readiness.ts src/domain/logic/readiness.test.ts src/domain/logic/progress.ts src/domain/logic/progress.test.ts src/presentation/hooks/useReadiness.ts src/pages/Repertoire.tsx src/pages/EventPage.tsx src/pages/ReadinessPage.tsx src/components/diary/SegmentHistory.tsx src/components/diary/ProgressDashboard.tsx src/lib/language/it.json src/lib/language/en.json src/lib/language/es.json src/lib/language/de.json src/lib/i18n.test.ts
git commit -m "feat: evidence and coverage replace readiness percentages; mood/focus trends"
```

---

### Task 4: CSV export and data-only JSON backup v3

Covers spec §11 and the backup/import copy of §6.

**Files:**
- Create: `src/application/useCases/exportCsv.ts`, `src/application/useCases/exportCsv.test.ts`
- Modify: `src/application/useCases/exportBackup.ts`, `src/application/useCases/importBackup.ts`, `src/application/useCases/backup.test.ts`
- Modify: `src/infrastructure/gateways/BrowserBackupFileGateway.ts`, `src/infrastructure/compositionRoot.ts`
- Modify: `src/pages/Profile.tsx`, `src/lib/language/{it,en,es,de}.json`

**Interfaces:**
- Consumes: `Session` (Task 1), `withSessionContext` (Task 1), `BackupFileGateway.save(filename, content)`, `sessionRepository.list()`.
- Produces:
  - `csvCell(value: unknown): string`, `toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string`
  - `SESSION_COLUMNS`, `RESULT_COLUMNS`
  - `practiceCsv(sessions: Session[], from?: string, to?: string): { sessions: string; results: string }`
  - `ExportCsvUseCase.execute(from?: string, to?: string): Promise<void>` → saves `sessioni.csv`, `risultati.csv`
  - Backup `version: 3`; `ImportBackupUseCase` accepts 1, 2, 3, validates session rows, back-fills `< 3`. (Task 5 extends it with recordings.)
  - `application.backups.csv` in the composition root.

- [ ] **Step 1: Write the failing tests**

Create `src/application/useCases/exportCsv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Session } from "@/domain/entities/session";
import { RESULT_COLUMNS, SESSION_COLUMNS, csvCell, practiceCsv } from "./exportCsv";

const session = (over: Partial<Session>): Session => ({ id: 1, date: "2026-10-01", marks: [], createdAt: 1, ...over });
const lines = (csv: string) => csv.replace("﻿", "").split("\r\n");

describe("csv export", () => {
  it("escapes quotes, newlines and accents, and guards formulas", () => {
    expect(csvCell('Ré "minore"\nbis')).toBe('"Ré ""minore""\nbis"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+39 bars")).toBe("'+39 bars");
    expect(csvCell("-2 bars")).toBe("'-2 bars");
    expect(csvCell("@here")).toBe("'@here");
    expect(csvCell(["RH", "LH"])).toBe('"[""RH"",""LH""]"');
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(undefined)).toBe("");
  });

  it("writes one row per session and one per studied section, related by session id, within the period", () => {
    const csv = practiceCsv([
      session({
        id: 7, taskId: 3, subjectId: 1, linkType: "item", itemId: 9, notStudied: [12], notes: "ok",
        snapshot: { taskTitle: "Ballade", subjectName: "Piano", segments: [{ id: "11", label: "Intro" }, { id: "12", label: "Coda" }] },
        marks: [{ segmentId: 11, bpm: 72, noteVal: "dotted-quarter", layers: ["RH"], techniques: [4], confidence: 3, mood: 4, focus: 2 }],
      }),
      session({ id: 8, date: "2026-11-01", subjectId: 1, linkType: "free", marks: [{ layers: [], techniques: [], confidence: 5 }] }),
    ], "2026-10-01", "2026-10-31");

    expect(lines(csv.sessions)).toEqual([SESSION_COLUMNS.join(","), "7,3,2026-10-01,1,Piano,item,9,,Ballade,,,[12],ok", ""]);
    expect(lines(csv.results)).toEqual([RESULT_COLUMNS.join(","), '7,segment,11,Intro,72,dotted-quarter,3,4,2,"[""RH""]",[4]', ""]);
    expect(csv.sessions + csv.results).not.toMatch(/duration|minute|blob:|base64|file:/i);
  });

  it("exports the whole history without a period and starts with a UTF-8 BOM", () => {
    const csv = practiceCsv([session({ id: 1 }), session({ id: 2, date: "2020-01-01" })]);
    expect(csv.sessions.startsWith("﻿")).toBe(true);
    expect(lines(csv.sessions)).toHaveLength(4);
  });
});
```

In `src/application/useCases/backup.test.ts`: change the expected export to `version: 3`, add `import type { Session } from "@/domain/entities/session";`, and append:

```ts
  it("rejects unknown versions and out-of-scale ratings before touching data", async () => {
    const repository = new FakeBackupRepository();
    const useCase = new ImportBackupUseCase(repository, new FakeFiles());
    await expect(useCase.importContent(JSON.stringify({ version: 99, data: {} }))).rejects.toThrow("Unsupported backup version: 99");
    await expect(useCase.importContent(JSON.stringify({ version: 3, data: { sessions: [{ id: 1, date: "2026-10-01", marks: [{ layers: [], techniques: [], mood: 6 }], createdAt: 1 }] } }))).rejects.toThrow();
    expect(repository.imported).toBeUndefined();
  });

  it("back-fills session references in older backups and leaves missing ratings missing", async () => {
    const repository = new FakeBackupRepository();
    await new ImportBackupUseCase(repository, new FakeFiles()).importContent(JSON.stringify({ version: 2, data: {
      tasks: [{ id: 4, subjectId: 2, linkType: "item", itemId: 5, title: "Etude", date: "2026-10-01", plan: [], done: true, createdAt: 1 }],
      sessions: [{ id: 1, taskId: 4, date: "2026-10-01", marks: [{ layers: [], techniques: [], confidence: 3 }], notes: "keep", createdAt: 1 }],
    } }));
    const [imported] = repository.imported?.sessions as Session[];
    expect(imported).toMatchObject({ subjectId: 2, itemId: 5, notes: "keep", marks: [{ confidence: 3 }] });
    expect(imported.marks[0].mood).toBeUndefined();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/application/useCases/exportCsv.test.ts src/application/useCases/backup.test.ts`
Expected: FAIL — module `./exportCsv` not found; export version is 2; invalid ratings accepted.

- [ ] **Step 3: Implement CSV and backup v3**

Create `src/application/useCases/exportCsv.ts`:

```ts
import type { Session } from "@/domain/entities/session";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";

const FORMULA = /^[=+\-@\t\r]/;

/** One CSV field: text is guarded against spreadsheet formulas, arrays become JSON, missing values stay empty. */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = Array.isArray(value) ? JSON.stringify(value) : typeof value === "string" && FORMULA.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with BOM and CRLF, so spreadsheets open accents correctly. */
export const toCsv = (columns: readonly string[], rows: Record<string, unknown>[]): string =>
  `﻿${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n")}\r\n`;

export const SESSION_COLUMNS = ["session_id", "task_id", "date", "subject_id", "subject", "content_type", "item_id", "collection_id", "title", "item_title", "collection", "not_studied_segment_ids", "notes"] as const;
export const RESULT_COLUMNS = ["session_id", "scope", "segment_id", "segment_label", "bpm", "note_value", "confidence", "mood", "focus", "layers", "technique_ids"] as const;

/** `sessioni.csv` (one row per session) and `risultati.csv` (one row per studied section) for sessions dated in [from, to]. */
export function practiceCsv(sessions: Session[], from?: string, to?: string): { sessions: string; results: string } {
  const picked = sessions
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const label = (s: Session, segmentId?: number) => s.snapshot?.segments?.find((seg) => seg.id === String(segmentId))?.label;
  return {
    sessions: toCsv(SESSION_COLUMNS, picked.map((s) => ({
      session_id: s.id, task_id: s.taskId, date: s.date, subject_id: s.subjectId, subject: s.snapshot?.subjectName,
      content_type: s.linkType, item_id: s.itemId, collection_id: s.collectionId, title: s.snapshot?.taskTitle,
      item_title: s.snapshot?.itemTitle, collection: s.snapshot?.collectionName, not_studied_segment_ids: s.notStudied, notes: s.notes,
    }))),
    results: toCsv(RESULT_COLUMNS, picked.flatMap((s) => s.marks.map((m) => ({
      session_id: s.id, scope: m.segmentId === undefined ? "whole" : "segment", segment_id: m.segmentId, segment_label: label(s, m.segmentId),
      bpm: m.bpm, note_value: m.bpm ? m.noteVal ?? "quarter" : undefined,
      confidence: m.confidence, mood: m.mood, focus: m.focus, layers: m.layers, technique_ids: m.techniques,
    })))),
  };
}

export class ExportCsvUseCase {
  constructor(private readonly sessions: { list(): Promise<Session[]> }, private readonly files: BackupFileGateway) {}

  // ponytail: two separate saves (two downloads / two share sheets on Android); zip them only if users ask.
  async execute(from?: string, to?: string): Promise<void> {
    const csv = practiceCsv(await this.sessions.list(), from, to);
    await this.files.save("sessioni.csv", csv.sessions);
    await this.files.save("risultati.csv", csv.results);
  }
}
```

`src/application/useCases/exportBackup.ts` — `version: 3`.

`src/application/useCases/importBackup.ts` — replace with:

```ts
import { z } from "zod";
import type { Session } from "@/domain/entities/session";
import type { Task } from "@/domain/entities/task";
import { withSessionContext } from "@/domain/logic/sessionContext";
import type { BackupFileGateway } from "@/domain/ports/BackupFileGateway";
import type { BackupData, BackupPort } from "@/domain/ports/backup";

const SUPPORTED_VERSIONS = [1, 2, 3];

const backupSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.number().optional(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
});

const rating = z.number().int().min(1).max(5).optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Stored sessions: ratings may be missing (legacy) but never out of scale. */
const sessionRow = z.object({
  id: z.number().int().positive(),
  taskId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  date: day,
  marks: z.array(z.object({ segmentId: z.number().int().positive().optional(), confidence: rating, mood: rating, focus: rating }).passthrough()),
  notStudied: z.array(z.number().int().positive()).optional(),
}).passthrough();

export class ImportBackupUseCase {
  constructor(private readonly backups: BackupPort, private readonly files: BackupFileGateway) {}

  /** Validates everything first; the store is replaced only by a fully valid backup, in one transaction. */
  async importContent(text: string): Promise<void> {
    const parsed = backupSchema.parse(JSON.parse(text));
    const version = parsed.version ?? 1;
    if (!SUPPORTED_VERSIONS.includes(version)) throw new Error(`Unsupported backup version: ${version}`);
    const data: BackupData = { ...(parsed.data ?? {}) };
    if (data.sessions) {
      const sessions = z.array(sessionRow).parse(data.sessions);
      // Rows are validated above; the cast only bridges zod's passthrough type to the entity.
      data.sessions = version < 3 ? withSessionContext(sessions as Partial<Session>[], (data.tasks ?? []) as Task[]) : sessions;
    }
    await this.backups.importAll(data);
  }

  async execute(): Promise<boolean> {
    const text = await this.files.pick();
    if (text === null) return false;
    await this.importContent(text);
    return true;
  }
}
```

`src/infrastructure/gateways/BrowserBackupFileGateway.ts` — `const blob = new Blob([content], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/json" });`.

`src/infrastructure/compositionRoot.ts` — import `ExportCsvUseCase` and add `csv: new ExportCsvUseCase(sessionRepository, backupFiles),` inside `backups`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/application`
Expected: PASS.

- [ ] **Step 5: Profile data section with the data-only contract**

In `src/pages/Profile.tsx` add `FileSpreadsheet` to the `lucide-react` import, state `const [csvFrom, setCsvFrom] = useState(""); const [csvTo, setCsvTo] = useState("");`, the handler

```ts
  const onExportCsv = async () => {
    try {
      await applicationCommands.backups.csv.execute(csvFrom || undefined, csvTo || undefined);
      toast.success(t("toast.csvExported"));
    } catch (error) {
      toast.error((error as Error).message || t("errors.couldNotSave"));
    }
  };
```

and replace the two-button grid of `#settings-data` with:

```tsx
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Button variant="outline" onClick={onExport} disabled={backup.progress !== "idle"} className="w-full">
                  <Download className="h-4 w-4 mr-2" />{t("profile.exportData")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("profile.exportDataHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Button variant="outline" onClick={onImport} disabled={backup.progress !== "idle"} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />{t("profile.import")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("profile.importHint")}</p>
              </div>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs font-medium">{t("profile.csvFrom")}<Input type="date" value={csvFrom} max={csvTo || undefined} onChange={(e) => setCsvFrom(e.target.value)} /></label>
                <label className="grid gap-1 text-xs font-medium">{t("profile.csvTo")}<Input type="date" value={csvTo} min={csvFrom || undefined} onChange={(e) => setCsvTo(e.target.value)} /></label>
              </div>
              <p className="text-xs text-muted-foreground">{t("profile.csvHint")}</p>
              <Button variant="outline" onClick={() => void onExportCsv()} className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />{t("profile.exportCsv")}
              </Button>
            </div>
```

- [ ] **Step 6: Strings**

```bash
node - <<'EOF'
const fs = require("fs");
const add = {
  it: {
    "profile.exportData": "Esporta backup dei dati", "profile.exportDataHint": "Include dati e valutazioni. Non include i file audio.",
    "profile.importHint": "Importa solo dati. I file audio non vengono ripristinati. Le registrazioni locali non vengono importate o esportate.",
    "profile.exportCsv": "Esporta dati CSV — senza file audio", "profile.csvFrom": "Dal", "profile.csvTo": "Al",
    "profile.csvHint": "Senza date esporta tutto lo storico.", "toast.csvExported": "File CSV esportati"
  },
  en: {
    "profile.exportData": "Export data backup", "profile.exportDataHint": "Includes data and ratings. Does not include audio files.",
    "profile.importHint": "Imports data only. Audio files are not restored. Local recordings are never imported or exported.",
    "profile.exportCsv": "Export CSV data — no audio files", "profile.csvFrom": "From", "profile.csvTo": "To",
    "profile.csvHint": "Without dates, the whole history is exported.", "toast.csvExported": "CSV files exported"
  },
  es: {
    "profile.exportData": "Exportar copia de seguridad de los datos", "profile.exportDataHint": "Incluye datos y valoraciones. No incluye los archivos de audio.",
    "profile.importHint": "Importa solo datos. Los archivos de audio no se restauran. Las grabaciones locales no se importan ni se exportan.",
    "profile.exportCsv": "Exportar datos CSV — sin archivos de audio", "profile.csvFrom": "Desde", "profile.csvTo": "Hasta",
    "profile.csvHint": "Sin fechas se exporta todo el historial.", "toast.csvExported": "Archivos CSV exportados"
  },
  de: {
    "profile.exportData": "Datensicherung exportieren", "profile.exportDataHint": "Enthält Daten und Bewertungen. Keine Audiodateien.",
    "profile.importHint": "Importiert nur Daten. Audiodateien werden nicht wiederhergestellt. Lokale Aufnahmen werden weder importiert noch exportiert.",
    "profile.exportCsv": "CSV-Daten exportieren — ohne Audiodateien", "profile.csvFrom": "Von", "profile.csvTo": "Bis",
    "profile.csvHint": "Ohne Datum wird der gesamte Verlauf exportiert.", "toast.csvExported": "CSV-Dateien exportiert"
  },
};
const drop = ["profile.export"];
for (const [lang, keys] of Object.entries(add)) {
  const path = `src/lib/language/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const key of drop) delete dict[key];
  fs.writeFileSync(path, JSON.stringify(Object.assign(dict, keys), null, 2) + "\n");
}
EOF
```

(Check first: `grep -rn '"profile.export"' src --include=*.tsx --include=*.ts` prints nothing after Step 5, except `i18n.test.ts` — if listed there, replace it with `profile.exportData`.)

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint`
Expected: green.

Manual: Profile → export CSV without dates → two files; open `risultati.csv` in LibreOffice/Excel: accents intact, a note starting with "=" shows as text, one row per studied section. Export the JSON backup, wipe nothing, import it → data unchanged; an edited backup with `"mood": 9` is rejected and the data is untouched.

- [ ] **Step 8: Commit**

```bash
git add src/application/useCases/exportCsv.ts src/application/useCases/exportCsv.test.ts src/application/useCases/exportBackup.ts src/application/useCases/importBackup.ts src/application/useCases/backup.test.ts src/infrastructure/gateways/BrowserBackupFileGateway.ts src/infrastructure/compositionRoot.ts src/pages/Profile.tsx src/lib/language/it.json src/lib/language/en.json src/lib/language/es.json src/lib/language/de.json src/lib/i18n.test.ts
git commit -m "feat: CSV export and data-only backup v3 with validated legacy import"
```

---

### Task 5: Device-local recordings

Covers spec §3 (Audio), §6, §8 (clip coordination), §11 (audio metadata in backup), acceptance 9–12.

**Files:**
- Modify: `src/domain/entities/session.ts`; Create: `src/domain/ports/audio.ts`
- Modify: `src/domain/ports/session.ts`, `src/application/useCases/logSession.ts`, `src/application/useCases/importBackup.ts`, `src/application/useCases/backup.test.ts`
- Create: `src/infrastructure/dexie/audioDb.ts`, `src/infrastructure/audio/browserAudio.ts`, `src/infrastructure/repositories/dexie/recordingRepository.ts`, `src/infrastructure/audio/recordings.test.ts`
- Modify: `src/infrastructure/dexie/db.ts`, `src/infrastructure/dexie/presentationReadPort.ts`, `src/infrastructure/repositories/dexie/sessionRepository.ts`, `src/infrastructure/compositionRoot.ts`, `src/test/fakes/FakeSessionRepository.ts`
- Create: `src/components/diary/Recorder.tsx` (exports `Recorder`, `ClipDrafts`, `ClipPlayer`, `ClipList`, `AudioNotice`)
- Modify: `src/pages/SessionLogPage.tsx`, `src/pages/SessionPage.tsx`, `src/components/diary/PracticeMode.tsx`, `src/pages/Diary.tsx`, `src/pages/Profile.tsx`
- Modify: `android/app/src/main/AndroidManifest.xml`, `src/lib/language/{it,en,es,de}.json`

**Interfaces:**
- Consumes: `LogSessionUseCase` (Task 1), `ImportBackupUseCase` v3 (Task 4), `applicationCommands`.
- Produces:
  - `interface Recording { id?; uid: string; sessionId: number; segmentId?: number; date: string; title?: string; mimeType: string; durationMs: number; createdAt: number }`
  - `type AudioErrorCode = "denied" | "unavailable" | "unsupported" | "interrupted" | "quota"`; `class AudioError extends Error { code }`
  - `type AudioDraft = Pick<Recording, "uid" | "mimeType" | "durationMs" | "segmentId" | "title">`
  - `interface AudioPort { start(onInterrupt); stop(): Promise<AudioDraft>; url(uid): Promise<string | null>; release(url); available(uids): Promise<Set<string>>; discard(uids): Promise<void>; wipe(): Promise<void> }`
  - `interface RecordingPort { add(recording); rename(id, title?); remove(recording) }`
  - `SessionLogInput.clips?: AudioDraft[]`; `SessionLogTransaction.createRecording(recording: Omit<Recording, "id">): Promise<void>`
  - `ImportBackupUseCase(backups, files, clips?: Pick<AudioPort, "available">)`; `importContent` / `execute` resolve `ImportSummary = { recordings: number; available: number }` (`execute` → `null` when cancelled)
  - Dexie v15 `recordings: "++id, &uid, sessionId"`; second DB `virtuoso-audio` with `clips: "uid"` rows `{ uid, data: ArrayBuffer, mimeType }` (ArrayBuffer, not Blob: Blob does not round-trip in jsdom/fake-indexeddb and is fragile in old WebViews)
  - `application.audio`, `application.recordings`; reads `"recordings.session"` `[sessionId]`, `"recordings.item"` `[itemId]`

- [ ] **Step 1: Write the failing tests**

Create `src/infrastructure/audio/recordings.test.ts`:

```ts
import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "@/infrastructure/dexie/db";
import { audioDb } from "@/infrastructure/dexie/audioDb";
import { browserAudio } from "./browserAudio";
import { backupRepository } from "@/infrastructure/repositories/dexie/backupRepository";
import { sessionRepository } from "@/infrastructure/repositories/dexie/sessionRepository";
import { taskRepository } from "@/infrastructure/repositories/dexie/taskRepository";
import { LogSessionUseCase } from "@/application/useCases/logSession";
import { ImportBackupUseCase } from "@/application/useCases/importBackup";

const LOCAL = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const rated = { layers: [], techniques: [], mood: 3, focus: 3, confidence: 3 };
const files = { save: async () => undefined, pick: async () => null };

beforeEach(async () => {
  await db.delete(); await db.open();
  await audioDb.clips.clear();
});

it("saves clip metadata with the session and leaves none behind when the save fails", async () => {
  const subjectId = await db.subjects.add({ name: "Piano", type: "instrument", createdAt: 1 });
  const task = (await db.tasks.get(await taskRepository.create({ title: "Scales", date: "2026-10-01", subjectId, plan: [] })))!;
  const clips = [{ uid: LOCAL, mimeType: "audio/webm", durationMs: 1000 }];
  const original = db.helpRequests.add;
  db.helpRequests.add = (() => Promise.reject(new Error("help fails"))) as unknown as typeof db.helpRequests.add;
  await expect(new LogSessionUseCase(sessionRepository).execute(task, { date: "2026-10-01", marks: [rated], helpText: "?", clips })).rejects.toThrow("help fails");
  db.helpRequests.add = original;
  expect(await db.recordings.count()).toBe(0);

  const id = await new LogSessionUseCase(sessionRepository).execute(task, { date: "2026-10-01", marks: [rated], clips });
  expect(await db.recordings.where("sessionId").equals(id).toArray()).toMatchObject([{ uid: LOCAL, sessionId: id, date: "2026-10-01" }]);
});

it("deleting a session removes its clip metadata and local audio together", async () => {
  await audioDb.clips.put({ uid: LOCAL, data: new Uint8Array([1]).buffer, mimeType: "audio/webm" });
  await db.sessions.add({ id: 5, date: "2026-10-01", marks: [], createdAt: 1 });
  await db.recordings.add({ uid: LOCAL, sessionId: 5, date: "2026-10-01", mimeType: "audio/webm", durationMs: 900, createdAt: 1 });
  await sessionRepository.deleteWithTaskReset(5);
  expect(await db.recordings.count()).toBe(0);
  expect(await audioDb.clips.get(LOCAL)).toBeUndefined();
});

it("exports clip metadata but no audio, and import keeps local audio, matched by uid only", async () => {
  await audioDb.clips.put({ uid: LOCAL, data: new Uint8Array([1, 2]).buffer, mimeType: "audio/webm" });
  await db.sessions.add({ id: 1, date: "2026-10-01", marks: [], createdAt: 1 });
  await db.recordings.add({ id: 1, uid: LOCAL, sessionId: 1, date: "2026-10-01", mimeType: "audio/webm", durationMs: 900, createdAt: 1 });

  const exported = JSON.stringify(await backupRepository.exportAll());
  expect(exported).toContain(LOCAL);
  expect(exported).not.toMatch(/"data"|base64|blob:|file:\/\//);

  // A backup from another device reuses session id 1 and recording id 1 for a different clip.
  const summary = await new ImportBackupUseCase(backupRepository, files, browserAudio).importContent(JSON.stringify({ version: 3, data: {
    sessions: [{ id: 1, date: "2026-10-02", marks: [], createdAt: 2 }],
    recordings: [{ id: 1, uid: OTHER, sessionId: 1, date: "2026-10-02", mimeType: "audio/webm", durationMs: 500, createdAt: 2 }],
  } }));

  expect(summary).toEqual({ recordings: 1, available: 0 });
  expect(await audioDb.clips.get(LOCAL)).toBeDefined();
  expect(await browserAudio.url(OTHER)).toBeNull();
});

it("rejects recordings that carry audio payloads or point at missing sessions, without touching data", async () => {
  await db.subjects.add({ name: "Kept", type: "instrument", createdAt: 1 });
  const useCase = new ImportBackupUseCase(backupRepository, files, browserAudio);
  const base = { uid: OTHER, sessionId: 1, date: "2026-10-02", mimeType: "audio/webm", durationMs: 500, createdAt: 2 };
  await expect(useCase.importContent(JSON.stringify({ version: 3, data: { sessions: [{ id: 1, date: "2026-10-02", marks: [], createdAt: 2 }], recordings: [{ ...base, data: "AAAA" }] } }))).rejects.toThrow();
  await expect(useCase.importContent(JSON.stringify({ version: 3, data: { recordings: [base] } }))).rejects.toThrow(/missing session/);
  expect(await db.subjects.count()).toBe(1);
});
```

In `src/application/useCases/backup.test.ts`: the existing "imports supported backup data selected by gateway" expectation `resolves.toBe(true)` becomes `resolves.toEqual({ recordings: 0, available: 0 })`; any cancelled-import expectation of `false` becomes `null`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/infrastructure/audio/recordings.test.ts src/application/useCases/backup.test.ts`
Expected: FAIL — `audioDb`, `browserAudio`, `db.recordings` do not exist; `importContent` returns undefined.

- [ ] **Step 3: Domain contracts and use cases**

`src/domain/entities/session.ts` — append:

```ts
/** Metadata of a device-local audio clip; the audio itself lives outside every backup and is found by `uid`. */
export interface Recording {
  id?: number;
  /** Random UUID: the only link between metadata and local audio, immune to numeric id collisions on import. */
  uid: string;
  sessionId: number;
  segmentId?: number;
  date: string;
  title?: string;
  mimeType: string;
  /** Clip length for the player; never study time. */
  durationMs: number;
  createdAt: number;
}
```

Create `src/domain/ports/audio.ts`:

```ts
import type { Recording } from "../entities/session";

export type AudioErrorCode = "denied" | "unavailable" | "unsupported" | "interrupted" | "quota";

export class AudioError extends Error {
  constructor(readonly code: AudioErrorCode) { super(`audio:${code}`); }
}

/** A clip whose audio is already stored on the device while its metadata waits for the session save. */
export type AudioDraft = Pick<Recording, "uid" | "mimeType" | "durationMs" | "segmentId" | "title">;

export interface AudioPort {
  /** Starts recording; rejects with AudioError "denied" | "unavailable" | "unsupported". `onInterrupt` fires when the input stops by itself. */
  start(onInterrupt: () => void): Promise<void>;
  /** Stops and stores the audio locally; rejects with AudioError "quota" when it could not be stored. */
  stop(): Promise<AudioDraft>;
  /** Playable URL, or null when this device holds no audio for `uid`. */
  url(uid: string): Promise<string | null>;
  release(url: string): void;
  available(uids: string[]): Promise<Set<string>>;
  discard(uids: string[]): Promise<void>;
  /** Explicit "delete all data" only. */
  wipe(): Promise<void>;
}

export interface RecordingPort {
  add(recording: Omit<Recording, "id">): Promise<number>;
  rename(id: number, title: string | undefined): Promise<void>;
  /** Removes metadata and local audio together. */
  remove(recording: Recording): Promise<void>;
}
```

`src/domain/ports/session.ts` — import `Recording` from the entity and `AudioDraft` from `./audio`; `SessionLogInput` becomes `Pick<Session, "date" | "notes" | "marks"> & { helpText?: string; clips?: AudioDraft[] }`; add to `SessionLogTransaction`:

```ts
  createRecording(recording: Omit<Recording, "id">): Promise<void>;
```

`src/application/useCases/logSession.ts` — right after `syncTaskDone` inside the transaction:

```ts
      // Audio is already on the device; its metadata commits or rolls back with the session.
      for (const clip of input.clips ?? []) await transaction.createRecording({ ...clip, sessionId, date: input.date, createdAt });
```

`src/test/fakes/FakeSessionRepository.ts` — add `recordings: Omit<import("@/domain/entities/session").Recording, "id">[] = [];`, snapshot/restore it in `transaction` like `helpRequests`, and add `createRecording: async (recording) => { this.recordings.push(recording); },` to the transaction object.

`src/application/useCases/importBackup.ts` — add:

```ts
import type { AudioPort } from "@/domain/ports/audio";

export interface ImportSummary { recordings: number; available: number }

/** Clip metadata only: any audio payload, path or URL makes the backup invalid. */
const recordingRow = z.object({
  id: z.number().int().positive().optional(),
  uid: z.string().uuid(),
  sessionId: z.number().int().positive(),
  segmentId: z.number().int().positive().optional(),
  date: day,
  title: z.string().max(160).optional(),
  mimeType: z.string().regex(/^audio\//),
  durationMs: z.number().nonnegative(),
  createdAt: z.number(),
}).strict();
```

constructor `constructor(private readonly backups: BackupPort, private readonly files: BackupFileGateway, private readonly clips?: Pick<AudioPort, "available">) {}`, and `importContent` becomes `async importContent(text: string): Promise<ImportSummary>` with, before `importAll`:

```ts
    const recordings = z.array(recordingRow).parse(data.recordings ?? []);
    const sessionIds = new Set((data.sessions ?? []).map((session) => (session as { id: number }).id));
    const dangling = recordings.find((recording) => !sessionIds.has(recording.sessionId));
    if (dangling) throw new Error(`Recording ${dangling.uid} points at missing session ${dangling.sessionId}`);
```

and after it:

```ts
    // Local audio is never touched by an import; report how many referenced clips this device can still play.
    const available = this.clips && recordings.length ? (await this.clips.available(recordings.map((r) => r.uid))).size : 0;
    return { recordings: recordings.length, available };
```

`execute()` returns `Promise<ImportSummary | null>`: `if (text === null) return null; return this.importContent(text);`.

- [ ] **Step 4: Infrastructure**

Create `src/infrastructure/dexie/audioDb.ts`:

```ts
import Dexie, { type Table } from "dexie";

/** Audio bytes, kept in their own database so backup export, import and data wipes of the app tables never see them. */
interface ClipRow { uid: string; data: ArrayBuffer; mimeType: string }

class AudioDB extends Dexie {
  declare clips: Table<ClipRow, string>;
  constructor() {
    super("virtuoso-audio");
    this.version(1).stores({ clips: "uid" });
  }
}

export const audioDb = new AudioDB();
```

Create `src/infrastructure/audio/browserAudio.ts`:

```ts
import { AudioError, type AudioDraft, type AudioPort } from "@/domain/ports/audio";
import { audioDb } from "@/infrastructure/dexie/audioDb";

const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let endedAt = 0;
let stopped: Promise<void> = Promise.resolve();

const failure = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : "";
  return new AudioError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError" ? "unavailable" : "unsupported");
};

/** MediaRecorder + IndexedDB: no plugin, no backend; audio never leaves the device. */
export const browserAudio: AudioPort = {
  async start(onInterrupt) {
    const mimeType = typeof MediaRecorder === "undefined" ? undefined : TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    if (!navigator.mediaDevices?.getUserMedia || mimeType === undefined) throw new AudioError("unsupported");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (error) { throw failure(error); }
    void navigator.storage?.persist?.();
    const active = new MediaRecorder(stream, { mimeType });
    chunks = [];
    stopped = new Promise((resolve) => { active.onstop = () => { endedAt = Date.now(); resolve(); }; });
    active.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    active.onerror = onInterrupt;
    stream.getAudioTracks()[0]?.addEventListener("ended", onInterrupt, { once: true });
    recorder = active;
    startedAt = Date.now();
    active.start(1000);
  },
  async stop(): Promise<AudioDraft> {
    const active = recorder;
    if (!active) throw new AudioError("unavailable");
    if (active.state !== "inactive") active.stop();
    await stopped;
    active.stream.getTracks().forEach((track) => track.stop());
    recorder = null;
    const data = await new Blob(chunks, { type: active.mimeType }).arrayBuffer();
    chunks = [];
    if (!data.byteLength) throw new AudioError("interrupted");
    const draft: AudioDraft = { uid: crypto.randomUUID(), mimeType: active.mimeType, durationMs: endedAt - startedAt };
    try { await audioDb.clips.put({ uid: draft.uid, data, mimeType: draft.mimeType }); } catch { throw new AudioError("quota"); }
    return draft;
  },
  async url(uid) {
    const row = await audioDb.clips.get(uid);
    return row ? URL.createObjectURL(new Blob([row.data], { type: row.mimeType })) : null;
  },
  release: (url) => URL.revokeObjectURL(url),
  async available(uids) { return new Set(uids.length ? await audioDb.clips.where("uid").anyOf(uids).primaryKeys() : []); },
  async discard(uids) { if (uids.length) await audioDb.clips.bulkDelete(uids); },
  async wipe() { await audioDb.clips.clear(); },
};
```

Create `src/infrastructure/repositories/dexie/recordingRepository.ts`:

```ts
import { db } from "@/infrastructure/dexie/db";
import { browserAudio } from "@/infrastructure/audio/browserAudio";
import type { RecordingPort } from "@/domain/ports/audio";

export const recordingRepository = {
  add: (recording) => db.recordings.add(recording) as Promise<number>,
  rename: async (id, title) => { await db.recordings.update(id, { title }); },
  // Metadata first: a failed audio delete leaves preserved audio, never a row that promises missing audio.
  async remove(recording) {
    if (recording.id !== undefined) await db.recordings.delete(recording.id);
    await browserAudio.discard([recording.uid]);
  },
} satisfies RecordingPort;
```

`src/infrastructure/dexie/db.ts` — `declare recordings: Table<Recording, number, Draft<Recording>>;` (import `Recording` from `@/domain/entities/session`) and:

```ts
    // v15: clip metadata (exported with backups); the audio itself lives in the separate "virtuoso-audio" database.
    this.version(15).stores({ recordings: "++id, &uid, sessionId" });
```

`src/infrastructure/repositories/dexie/sessionRepository.ts` — import `browserAudio`; add `db.recordings` to the `transaction` table list and `createRecording: async (recording) => { await db.recordings.add(recording); },`; replace `deleteWithTaskReset` with:

```ts
  async deleteWithTaskReset(id: number, taskId?: number) {
    const clips = await db.transaction("rw", db.tasks, db.sessions, db.recordings, async () => {
      const rows = await db.recordings.where("sessionId").equals(id).toArray();
      await db.recordings.bulkDelete(rows.flatMap((row) => (row.id === undefined ? [] : [row.id])));
      await db.sessions.delete(id);
      if (taskId !== undefined) await syncTaskDone(taskId);
      return rows;
    });
    await browserAudio.discard(clips.map((clip) => clip.uid));
  },
```

`src/infrastructure/dexie/presentationReadPort.ts` — add:

```ts
      case "recordings.session": return (typeof first === "number" ? db.recordings.where("sessionId").equals(first).toArray() : Promise.resolve([])) as unknown as Promise<T>;
      case "recordings.item": return (async () => {
        if (typeof first !== "number") return [];
        const ids = await db.sessions.where("itemId").equals(first).primaryKeys();
        return ids.length ? db.recordings.where("sessionId").anyOf(ids).toArray() : [];
      })() as unknown as Promise<T>;
```

`src/infrastructure/compositionRoot.ts` — import `browserAudio` and `recordingRepository`; inside `application` add `audio: browserAudio, recordings: recordingRepository,`; change `import: new ImportBackupUseCase(backupRepository, backupFiles, browserAudio)` and `wipe: async () => { await backupRepository.wipeAll(); await browserAudio.wipe(); },`.

`android/app/src/main/AndroidManifest.xml` — next to the other permissions:

```xml
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

(Capacitor's WebChromeClient turns the WebView's microphone request into the runtime permission prompt.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/infrastructure src/application`
Expected: PASS.

- [ ] **Step 6: Recorder and clip UI**

Create `src/components/diary/Recorder.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Recording } from "@/domain/entities/session";
import { AudioError, type AudioDraft } from "@/domain/ports/audio";
import { applicationCommands } from "@/lib/applicationCommands";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { nativeSelect } from "./WhenFields";

type Section = { id: number; label: string };

/** The data-only contract, visible next to every recorder and clip list. */
export function AudioNotice() {
  const { t } = useI18n();
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>{t("audio.notice")}</p>
      <p>{t("audio.loss")}</p>
    </div>
  );
}

/** Explicit record/stop; a finished clip is already stored on the device when `onClip` receives it. */
export function Recorder({ sections, onClip }: { sections: Section[]; onClip: (clip: AudioDraft) => void | Promise<void> }) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [segmentId, setSegmentId] = useState<number | undefined>();
  const fail = (error: unknown) => toast.error(t(`audio.error.${error instanceof AudioError ? error.code : "unsupported"}`));
  const stop = async (interrupted = false) => {
    setRecording(false);
    try {
      const clip = await applicationCommands.audio.stop();
      await onClip({ ...clip, segmentId });
      if (interrupted) toast(t("audio.error.interrupted"));
    } catch (error) { fail(error); }
  };
  const start = async () => {
    try { await applicationCommands.audio.start(() => void stop(true)); setRecording(true); } catch (error) { fail(error); }
  };
  return (
    <div className="space-y-3">
      <AudioNotice />
      <div className="flex flex-wrap items-center gap-2">
        {sections.length > 0 && (
          <select aria-label={t("audio.segment")} value={segmentId ?? ""} disabled={recording} onChange={(e) => setSegmentId(e.target.value ? Number(e.target.value) : undefined)} className={nativeSelect}>
            <option value="">{t("audio.noSegment")}</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        {recording
          ? <Button type="button" variant="destructive" onClick={() => void stop()}><Square />{t("audio.stop")}</Button>
          : <Button type="button" variant="outline" onClick={() => void start()}><Mic />{t("audio.record")}</Button>}
        {recording && <span role="status" className="text-sm font-medium text-destructive">{t("audio.recording")}</span>}
      </div>
    </div>
  );
}

/** Native player for one local clip; starting it pauses every other clip, so two takes can be compared back to back. */
export function ClipPlayer({ uid, label }: { uid: string; label: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null | undefined>();
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void applicationCommands.audio.url(uid).then((u) => { url = u; if (live) setSrc(u); else if (u) applicationCommands.audio.release(u); });
    return () => { live = false; if (url) applicationCommands.audio.release(url); };
  }, [uid]);
  if (src === undefined) return null;
  if (src === null) return <p className="text-xs text-muted-foreground">{t("audio.unavailable")}</p>;
  return <audio ref={ref} controls preload="metadata" src={src} aria-label={label} className="w-full" onPlay={() => document.querySelectorAll("audio").forEach((el) => { if (el !== ref.current) el.pause(); })} />;
}

/** Clips of a session being logged: stored on the device, saved with the session, discarded explicitly. */
export function ClipDrafts({ clips, onChange, sections }: { clips: AudioDraft[]; onChange: (clips: AudioDraft[]) => void; sections: Section[] }) {
  const { t } = useI18n();
  const discard = (uid: string) => { void applicationCommands.audio.discard([uid]); onChange(clips.filter((c) => c.uid !== uid)); };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t("audio.title")}</h3>
      <Recorder sections={sections} onClip={(clip) => onChange([...clips, clip])} />
      {clips.length > 0 && (
        <ul className="space-y-3">
          {clips.map((clip) => (
            <li key={clip.uid} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t("audio.draft")}{clip.segmentId !== undefined ? ` · ${sections.find((s) => s.id === clip.segmentId)?.label ?? ""}` : ""}</p>
              <div className="flex items-center gap-2">
                <Input value={clip.title ?? ""} maxLength={160} aria-label={t("audio.rename")} placeholder={t("audio.rename")} onChange={(e) => onChange(clips.map((c) => (c.uid === clip.uid ? { ...c, title: e.target.value || undefined } : c)))} />
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label={t("audio.discard")} onClick={() => discard(clip.uid)}><Trash2 /></Button>
              </div>
              <ClipPlayer uid={clip.uid} label={clip.title ?? t("audio.draft")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Saved clips: play, rename, delete (metadata and audio together). */
export function ClipList({ recordings, sections }: { recordings: Recording[]; sections: Section[] }) {
  const { t, lang } = useI18n();
  const [confirm, setConfirm] = useState<Recording | null>(null);
  return (
    <>
      <ul className="space-y-4">
        {recordings.map((r) => {
          const label = r.title ?? [formatDate(r.date, lang, "medium"), sections.find((s) => s.id === r.segmentId)?.label].filter(Boolean).join(" · ");
          return (
            <li key={r.uid} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Input defaultValue={r.title ?? ""} placeholder={label} maxLength={160} aria-label={t("audio.rename")} onBlur={(e) => void applicationCommands.recordings.rename(r.id!, e.target.value.trim() || undefined)} />
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11 hover:text-destructive" aria-label={t("audio.delete")} onClick={() => setConfirm(r)}><Trash2 /></Button>
              </div>
              <ClipPlayer uid={r.uid} label={label} />
            </li>
          );
        })}
      </ul>
      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("audio.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("audio.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirm) void applicationCommands.recordings.remove(confirm); setConfirm(null); }}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

`src/pages/SessionLogPage.tsx`:
- `type Prefill = { marks?: SegmentMark[]; notes?: string; clips?: AudioDraft[] };` (import `AudioDraft` from `@/domain/ports/audio`, `ClipDrafts` from `@/components/diary/Recorder`).
- In both forms: `const [clips, setClips] = useState<AudioDraft[]>(prefill?.clips ?? []);` (free form: `[]`), `const leave = () => { void applicationCommands.audio.discard(clips.map((c) => c.uid)); goBack(); };`, pass `clips` in the log input, use `leave` for the `Footer` `onCancel`, and give `BackLink` an `onClick={leave}` (add `onClick?: () => void` to `BackLink` and pass it to the `Link`).
- Render `<div className={section}><ClipDrafts clips={clips} onChange={setClips} sections={rows} /></div>` above the notes block (free form: `sections={itemSegments?.map((s) => ({ id: s.id, label: s.label })) ?? []}`).

`src/components/diary/PracticeMode.tsx` — `onFinish: (payload: { marks: SegmentMark[]; clips: AudioDraft[] }) => void`; add `const [clips, setClips] = useState<AudioDraft[]>([]);`, render `<ClipDrafts clips={clips} onChange={setClips} sections={segments?.map((s) => ({ id: s.id, label: s.label })) ?? []} />` below the confidence group, `finish = () => onFinish({ marks, clips })`, and wrap `onClose` so closing discards drafts: `const close = () => { void applicationCommands.audio.discard(clips.map((c) => c.uid)); onClose(); };` used everywhere `onClose` was. In `src/pages/Diary.tsx` the `onFinish` handler becomes `({ marks, clips }) => { navigate(\`/log?task=${practiceTask.id}\`, { state: { prefill: { marks, clips } } }); setPracticeTask(null); }`.

`src/pages/SessionPage.tsx` — reads `const recordings = usePresentationRead<Recording[]>("recordings.session", [session.id]) ?? []; const sameContent = usePresentationRead<Recording[]>("recordings.item", [session.itemId]) ?? []; const others = sameContent.filter((r) => r.sessionId !== session.id);`; in view mode, after the notes section:

```tsx
            <section>
              <SectionHeader title={t("audio.title")} />
              <Recorder sections={sections} onClip={async (clip) => {
                try { await applicationCommands.recordings.add({ ...clip, sessionId: session.id, date: session.date, createdAt: Date.now() }); }
                catch { await applicationCommands.audio.discard([clip.uid]); toast.error(t("errors.couldNotSave")); }
              }} />
              {recordings.length > 0 && <div className="mt-4"><ClipList recordings={recordings} sections={sections} /></div>}
            </section>
            {others.length > 0 && (
              <section>
                <SectionHeader title={t("audio.other")} />
                <ClipList recordings={others} sections={sections} />
              </section>
            )}
```

and the delete dialog description becomes `{t("dialog.deleteSessionDesc")}{recordings.length ? ` ${t("audio.deleteSessionClips", { count: recordings.length })}` : ""}`.

`src/pages/Profile.tsx` — `onImport` toasts the summary (`useBackupCommands` types the value as `unknown`; import `type ImportSummary` from `@/application/useCases/importBackup`):

```ts
    const summary = result.ok ? (result.value as ImportSummary | null) : null;
    if (summary) toast.success(summary.recordings ? t("toast.importedClips", { available: summary.available, missing: summary.recordings - summary.available }) : t("toast.imported"));
    else if (!result.ok) toast.error(t("errors.invalidFile"));
```

(these three lines replace the body of `onImport` after `const result = await backup.importBackup();`).

and in the wipe confirmation, above the DELETE prompt, `<p className="text-sm text-destructive">{t("profile.wipeAudio")}</p>`.

- [ ] **Step 7: Strings**

```bash
node - <<'EOF'
const fs = require("fs");
const add = {
  it: {
    "audio.notice": "Le registrazioni restano su questo dispositivo. Non sono incluse nei backup e non possono essere importate o esportate.",
    "audio.loss": "Se cancelli i dati dell'app o il suo archivio locale va perso, le registrazioni non sono recuperabili.",
    "audio.unavailable": "Audio non disponibile su questo dispositivo. Il backup contiene solo i dati della registrazione.",
    "audio.title": "Registrazioni", "audio.record": "Registra", "audio.stop": "Interrompi", "audio.recording": "Registrazione in corso…",
    "audio.rename": "Titolo della registrazione", "audio.delete": "Elimina registrazione", "audio.deleteDesc": "La clip e i suoi dati verranno eliminati da questo dispositivo.",
    "audio.discard": "Scarta la registrazione", "audio.draft": "Da salvare con la sessione", "audio.segment": "Sezione", "audio.noSegment": "Tutta la sessione",
    "audio.other": "Altre registrazioni di questo contenuto",
    "audio.error.denied": "Accesso al microfono negato. Consentilo nelle impostazioni per registrare.",
    "audio.error.unavailable": "Nessun microfono disponibile.",
    "audio.error.unsupported": "Questo dispositivo non supporta la registrazione audio.",
    "audio.error.interrupted": "Registrazione interrotta: è stata conservata la parte registrata.",
    "audio.error.quota": "Spazio insufficiente: la clip non è stata salvata.",
    "audio.deleteSessionClips": "Verrà eliminata anche {{count}} registrazione.", "audio.deleteSessionClips_plural": "Verranno eliminate anche {{count}} registrazioni.",
    "toast.importedClips": "Dati importati. Registrazioni referenziate: {{available}} disponibili, {{missing}} non disponibili.",
    "profile.wipeAudio": "Elimina anche tutte le registrazioni audio di questo dispositivo."
  },
  en: {
    "audio.notice": "Recordings stay on this device. They are not included in backups and cannot be imported or exported.",
    "audio.loss": "Clearing the app's data or losing its local storage can make recordings unrecoverable.",
    "audio.unavailable": "Audio not available on this device. The backup only holds the recording's data.",
    "audio.title": "Recordings", "audio.record": "Record", "audio.stop": "Stop", "audio.recording": "Recording…",
    "audio.rename": "Recording title", "audio.delete": "Delete recording", "audio.deleteDesc": "The clip and its data will be deleted from this device.",
    "audio.discard": "Discard recording", "audio.draft": "Saved with the session", "audio.segment": "Section", "audio.noSegment": "Whole session",
    "audio.other": "Other recordings of this piece",
    "audio.error.denied": "Microphone access denied. Allow it in settings to record.",
    "audio.error.unavailable": "No microphone available.",
    "audio.error.unsupported": "This device can't record audio.",
    "audio.error.interrupted": "Recording interrupted: the recorded part was kept.",
    "audio.error.quota": "Not enough storage: the clip was not saved.",
    "audio.deleteSessionClips": "This also deletes {{count}} recording.", "audio.deleteSessionClips_plural": "This also deletes {{count}} recordings.",
    "toast.importedClips": "Data imported. Referenced recordings: {{available}} available, {{missing}} unavailable.",
    "profile.wipeAudio": "This also deletes every audio recording on this device."
  },
  es: {
    "audio.notice": "Las grabaciones permanecen en este dispositivo. No se incluyen en las copias de seguridad y no se pueden importar ni exportar.",
    "audio.loss": "Borrar los datos de la app o perder su almacenamiento local puede hacer irrecuperables las grabaciones.",
    "audio.unavailable": "Audio no disponible en este dispositivo. La copia de seguridad solo contiene los datos de la grabación.",
    "audio.title": "Grabaciones", "audio.record": "Grabar", "audio.stop": "Detener", "audio.recording": "Grabando…",
    "audio.rename": "Título de la grabación", "audio.delete": "Eliminar grabación", "audio.deleteDesc": "El clip y sus datos se eliminarán de este dispositivo.",
    "audio.discard": "Descartar grabación", "audio.draft": "Se guarda con la sesión", "audio.segment": "Sección", "audio.noSegment": "Toda la sesión",
    "audio.other": "Otras grabaciones de este contenido",
    "audio.error.denied": "Acceso al micrófono denegado. Permítelo en los ajustes para grabar.",
    "audio.error.unavailable": "No hay micrófono disponible.",
    "audio.error.unsupported": "Este dispositivo no admite la grabación de audio.",
    "audio.error.interrupted": "Grabación interrumpida: se conservó la parte grabada.",
    "audio.error.quota": "Espacio insuficiente: el clip no se guardó.",
    "audio.deleteSessionClips": "También se eliminará {{count}} grabación.", "audio.deleteSessionClips_plural": "También se eliminarán {{count}} grabaciones.",
    "toast.importedClips": "Datos importados. Grabaciones referenciadas: {{available}} disponibles, {{missing}} no disponibles.",
    "profile.wipeAudio": "También elimina todas las grabaciones de audio de este dispositivo."
  },
  de: {
    "audio.notice": "Aufnahmen bleiben auf diesem Gerät. Sie sind nicht in Sicherungen enthalten und können weder importiert noch exportiert werden.",
    "audio.loss": "Wenn du die App-Daten löschst oder der lokale Speicher verloren geht, sind die Aufnahmen nicht wiederherstellbar.",
    "audio.unavailable": "Audio auf diesem Gerät nicht verfügbar. Die Sicherung enthält nur die Daten der Aufnahme.",
    "audio.title": "Aufnahmen", "audio.record": "Aufnehmen", "audio.stop": "Stoppen", "audio.recording": "Aufnahme läuft…",
    "audio.rename": "Titel der Aufnahme", "audio.delete": "Aufnahme löschen", "audio.deleteDesc": "Der Clip und seine Daten werden von diesem Gerät gelöscht.",
    "audio.discard": "Aufnahme verwerfen", "audio.draft": "Wird mit der Sitzung gespeichert", "audio.segment": "Abschnitt", "audio.noSegment": "Ganze Sitzung",
    "audio.other": "Weitere Aufnahmen dieses Inhalts",
    "audio.error.denied": "Mikrofonzugriff verweigert. Erlaube ihn in den Einstellungen, um aufzunehmen.",
    "audio.error.unavailable": "Kein Mikrofon verfügbar.",
    "audio.error.unsupported": "Dieses Gerät unterstützt keine Audioaufnahme.",
    "audio.error.interrupted": "Aufnahme unterbrochen: der aufgenommene Teil wurde behalten.",
    "audio.error.quota": "Nicht genug Speicher: der Clip wurde nicht gespeichert.",
    "audio.deleteSessionClips": "Dabei wird auch {{count}} Aufnahme gelöscht.", "audio.deleteSessionClips_plural": "Dabei werden auch {{count}} Aufnahmen gelöscht.",
    "toast.importedClips": "Daten importiert. Referenzierte Aufnahmen: {{available}} verfügbar, {{missing}} nicht verfügbar.",
    "profile.wipeAudio": "Dabei werden auch alle Audioaufnahmen auf diesem Gerät gelöscht."
  },
};
for (const [lang, keys] of Object.entries(add)) {
  const path = `src/lib/language/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(path, "utf8"));
  fs.writeFileSync(path, JSON.stringify(Object.assign(dict, keys), null, 2) + "\n");
}
EOF
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint`
Expected: green, including `src/test/architecture/import-boundaries.test.ts` (no `Blob`/`createObjectURL` in presentation).

Manual, desktop Chrome (`npm run dev`): log a session, record two clips on different sections, play one then the other (the first pauses), rename one, discard one, save → session page lists the saved clip; reload offline (DevTools → Network → Offline) → it still plays. Deny the microphone → the "denied" message, nothing listed. Export the backup, delete the clip's audio with DevTools → Application → IndexedDB → `virtuoso-audio` → delete the row, import the backup → toast "1 disponibili/0 non disponibili" pattern reflects reality and the clip shows «Audio non disponibile su questo dispositivo…» with no player.

Manual, Android: `./build-apk.sh` then `adb install -r virtuoso-debug.apk`; first record shows the system microphone prompt; deny → message; allow → record, lock the screen mid-take → interrupted message keeps the recorded part; kill and reopen the app → the clip plays.

- [ ] **Step 9: Commit**

```bash
git add src/domain/entities/session.ts src/domain/ports/audio.ts src/domain/ports/session.ts src/application/useCases/logSession.ts src/application/useCases/importBackup.ts src/application/useCases/backup.test.ts src/infrastructure/dexie/audioDb.ts src/infrastructure/audio/browserAudio.ts src/infrastructure/audio/recordings.test.ts src/infrastructure/repositories/dexie/recordingRepository.ts src/infrastructure/dexie/db.ts src/infrastructure/dexie/presentationReadPort.ts src/infrastructure/repositories/dexie/sessionRepository.ts src/infrastructure/compositionRoot.ts src/test/fakes/FakeSessionRepository.ts src/components/diary/Recorder.tsx src/components/diary/PracticeMode.tsx src/pages/SessionLogPage.tsx src/pages/SessionPage.tsx src/pages/Diary.tsx src/pages/Profile.tsx android/app/src/main/AndroidManifest.xml src/lib/language/it.json src/lib/language/en.json src/lib/language/es.json src/lib/language/de.json
git commit -m "feat: device-local recordings with data-only backup contract"
```

---

## Final verification (whole branch, after Task 5)

- [ ] `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint && npm run build` — all green.
- [ ] Spec §14 walk-through in the browser at 390 px and 1440 px, keyboard only for one full log: criteria 1–17.
- [ ] `grep -rni "timer\|stopwatch\|minutes studied\|journal\|guided" src/pages src/components --include=*.tsx` — no new hits in the flows touched (the metronome stays).
- [ ] Run the design detector once over the changed UI: `/home/giulio/.claude/skills/impeccable/scripts/impeccable detect --json src/components/shared/RatingScale.tsx src/components/diary/MarksEditor.tsx src/components/diary/Recorder.tsx src/components/diary/UpdateNextTaskPanel.tsx src/components/diary/CompletionBar.tsx src/components/diary/RoutineBuilder.tsx src/pages/SessionLogPage.tsx src/pages/SessionPage.tsx src/pages/EventPage.tsx src/pages/ReadinessPage.tsx src/pages/Repertoire.tsx src/pages/Profile.tsx` and fix what it reports in one batch.

## Known ceilings (deliberate)

- Clip drafts are not persisted across a page reload of the log form; their audio stays on the device unlinked (preserved, never auto-deleted).
- A customized routine task blocks only the identical regenerated draw on its day (`ponytail:` comment in `studyRoutineRepository.ts`).
- CSV export triggers two downloads / two Android share sheets.
