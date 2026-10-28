# Rolling Schedule Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop pre-writing a year of future tasks; keep only a short rolling window of recurrence and routine occurrences in IndexedDB, topped up on app open, with routine draws using the freshest practice stats.

**Architecture:** Recurrences and routines already store their rule (`Task.recurrence` on the root, `StudyRoutine`). Creation writes only occurrences up to `scheduleWindowEnd`; each series/routine records `materializedUntil`; a startup top-up extends every live series/routine to the window end; a one-off prune (Dexie v19 + every backup import) deletes legacy untouched rows beyond the window.

**Tech Stack:** TypeScript, Dexie 4 (IndexedDB), React 18, Vitest + fake-indexeddb.

**Spec (from the size analysis, 2026-10-28):** `BU.json` = 1872 KB; tasks = 912 KB; 2456/2528 tasks are future rows up to 2027-09-24 (routine 1726, recurrences 796). Measured: a 14-day window leaves 204 tasks and a 134 KB compact backup. Plan bpm, sparse fields and sessions stay as they are (out of scope).

## Global Constraints

- `SCHEDULE_WINDOW_DAYS = 14`, exported from `src/lib/recurrence.ts`. One constant for recurrences and routines.
- Window end for a series: `scheduleWindowEnd(startDate, today) = addDays(max(startDate, today), SCHEDULE_WINDOW_DAYS)`, inclusive, `YYYY-MM-DD`.
- A recurrence always has at least one materialized occurrence after `today` while its rule still produces one (sparse series: `UpdateNextTaskPanel` needs the next task).
- Routine end is fixed: `routineEnd(routine) = startDate + weeksAhead * 7` days (exclusive). Regenerating no longer pushes the end forward (today `regenerate(fromDate)` generates `fromDate + weeksAhead*7`).
- Recurrence dates keep today's rule exactly: `expandTaskRecurrence` (cap `min(occurrences ?? 200, 200)`, 365-day horizon) decides *which* dates exist; the window only decides *when* they are written.
- No new dependency. No change to `Task.plan`, sessions, export format version (`6`).
- Commit with explicit paths: `git commit -- <paths>` (index may hold user-staged deletions).
- Today in repositories comes from `today()` in `@/lib/date`; in use cases from the injected `clock`.

## Review Focus

1. Sparse recurrence (every 30 days, or weekly with one weekday) after today must still have its next occurrence written. Test in Task 1 and Task 4.
2. Two top-ups at once (React StrictMode double effect, two tabs, resume + mount) must not duplicate rows. Test in Task 4.
3. Prune must never delete a row the user touched: `done`, `skipped`, `customized`, `executionNotes`, rows with sessions, rows in any `assignments.taskIds`, recurrence roots. Test in Task 5.
4. Deleted series must stay dead: `removeSeries` soft-deletes the root, so a root with `deletedAt` and no live future children is not extended; a root soft-deleted alone (its first day was deleted, children alive) still is. Test in Task 4.
5. Routine week continuity across a top-up boundary: per-week `repetitionCap` and `avoidBackToBack` hold across the day where one run ends and the next begins. Test in Task 2 (pure) and Task 4 (DB).

---

### Task 1: Window helper and windowed recurrence creation

**Files:**
- Modify: `src/lib/recurrence.ts` (add constant + helper; apply `Math.min(…, MAX_GENERATED)` cap to `occurrences`)
- Modify: `src/domain/entities/task.ts` (add `materializedUntil?: string` to `Task`, doc: "Recurrence root only: last date written to the DB.")
- Modify: `src/application/useCases/createTask.ts` (delete local `recurrenceDates`, `MAX_GENERATED`, `HORIZON_DAYS`; use `windowedRecurrenceDates`)
- Modify: `src/infrastructure/repositories/dexie/taskRepository.ts:41-43` (recurrence branch of `create` uses the same helper and stamps the root)
- Test: `src/application/useCases/taskSession.test.ts`, `src/lib/recurrence.test.ts` (create if absent)

**Interfaces:**
- Produces: `SCHEDULE_WINDOW_DAYS: 14`; `scheduleWindowEnd(startDate: string, today: string): string`; `windowedRecurrenceDates(rec: TaskRecurrence, after: string | undefined, today: string): string[]` — dates from `expandTaskRecurrence(rec)` that are `> after` (all when `after` undefined) and `<= scheduleWindowEnd(rec.startDate, today)`, plus the first date `> today` if none of the kept dates is `> today`; `Task.materializedUntil`.

- [ ] **Step 1: Write failing tests**

`recurrence.test.ts`:
- `scheduleWindowEnd("2026-10-01","2026-10-28") === "2026-11-11"`; `scheduleWindowEnd("2026-12-01","2026-10-28") === "2026-12-15"`.
- daily rule from `2026-10-28`, endDate `2027-06-30`, `after` undefined, today `2026-10-28` → 15 dates, last `"2026-11-11"`.
- `interval` every 30 days from `2026-10-20`, today `2026-10-28` → `["2026-10-20","2026-11-19"]`.
- same daily rule with `after: "2026-11-05"` → first `"2026-11-06"`, last `"2026-11-11"`.

`taskSession.test.ts` (clock = `Date.parse("2026-10-28T12:00:00")`): `CreateTaskUseCase` with a weekdays rule `[0..6]` to `2027-06-30` calls `createRecurring` with `first.materializedUntil === "2026-11-11"` and 14 follow-ups.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/recurrence.test.ts src/application/useCases/taskSession.test.ts`

- [ ] **Step 3: Implement** helper in `recurrence.ts`; `CreateTaskUseCase.execute` derives `today = dayKey(new Date(this.clock()))`, sets `materializedUntil` on the first row to the last returned date. Same in `taskRepository.create`.

- [ ] **Step 4: Run, expect PASS**, then `npx vitest run src/lib src/application src/infrastructure` and fix any test that counted a full year of occurrences (expect the window instead).

- [ ] **Step 5: Commit** — `git add` the files above; `git commit -m "feat: write recurring tasks only inside a 14-day window" -- <paths>`

---

### Task 2: Generator accepts an end date and the previous day's draws

**Files:**
- Modify: `src/lib/domain/studyRoutineGenerator.ts:197-242`
- Test: `src/lib/domain/studyRoutineGenerator.test.ts`

**Interfaces:**
- Produces on `GenerateRoutineTasksOptions`: `toDate?: string` (exclusive; default unchanged `fromDate + weeksAhead*7`), `lastUsed?: Map<string, string>` (pool key → last date drawn, seeds `lastUsedDate`). Also export `routineEnd(routine: Pick<StudyRoutine,"startDate"|"weeksAhead">): string` and `taskPoolKeys(task: Pick<Task,"collectionId"|"itemId"|"plan">): string[]` (moved from the inline `keys` expression in `studyRoutineRepository.regenerate`).

- [ ] **Step 1: Write failing tests** (deterministic `rng: mulberry32(1)`):
- `toDate` = fromDate + 3 days → every task date `< toDate`, at least one task on day 3 when the matrix has that weekday.
- `routineEnd({ startDate: "2026-10-18", weeksAhead: 49 }) === "2027-09-26"`.
- pool of 2 entries, `avoidBackToBack: true`, 1 draw/day, `lastUsed = { A: fromDate-1 }` → first day draws B.
- `repetitionCap: 1`, `seedCounters = { A: 1, B: 1 }` within the same week → no task until the week changes.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/domain/studyRoutineGenerator.test.ts`
- [ ] **Step 3: Implement** — `endDate = toDate ? parseDayKey(toDate) : addDays(startDate, routine.weeksAhead*7)`; `new Map(lastUsed ?? [])` for `lastUsedDate`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: let routine generation stop at a date and continue the previous day" -- <paths>`

---

### Task 3: Windowed routine creation and regeneration

**Files:**
- Modify: `src/domain/ports/studyRoutine.ts` (`materializedUntil?: string` on `StudyRoutine`, doc as in Task 1)
- Modify: `src/infrastructure/repositories/dexie/studyRoutineRepository.ts` (`generate`, `regenerate`, `create`, `createRoutine`)
- Modify: `src/application/useCases/generateStudyRoutine.ts`
- Test: `src/lib/services/studyRoutines.test.ts`, `src/application/useCases/generateStudyRoutine.test.ts`

**Interfaces:**
- Consumes: `scheduleWindowEnd` (Task 1); `toDate`, `lastUsed`, `routineEnd`, `taskPoolKeys` (Task 2).
- Produces: `generate(routine, fromDate, toDate, seedCounters?, kept?, lastUsed?)` — internal, writes tasks and sets `studyRoutines.materializedUntil` to the day before `toDate` in the same transaction. `weekContext(routineId, fromDate, weekStartsOn): Promise<{ counters: Map<string,number>; lastUsed: Map<string,string> }>` — counters from the routine's live tasks in `fromDate`'s week dated `< fromDate` plus done ones `>= fromDate`; `lastUsed` from tasks on `fromDate - 1`. Used by Task 4.

- [ ] **Step 1: Write failing tests** (fake-indexeddb, `vi.setSystemTime("2026-10-28T12:00:00")`):
- create a routine `weeksAhead: 49` starting `2026-10-28` → no task dated after `2026-11-11`; routine row has `materializedUntil === "2026-11-11"`.
- `GenerateStudyRoutineUseCase` with clock at the same instant → same two assertions.
- `regenerateFromDate(routine, "2026-10-30")` → still no task after `2026-11-11`, done tasks before untouched.
- routine starting `2026-12-01` → first task `>= "2026-12-01"`, last `<= "2026-12-15"`.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lib/services/studyRoutines.test.ts src/application/useCases/generateStudyRoutine.test.ts`
- [ ] **Step 3: Implement** — `toDate = min(routineEnd(routine), addDays(scheduleWindowEnd(routine.startDate, today()), 1))`; replace the inline counter block in `regenerate` with `weekContext`; `GenerateStudyRoutineUseCase` passes `toDate` and the stamp through `createRoutine`/`persistTasks` (add `materializedUntil` to the input it stores).
- [ ] **Step 4: Run, expect PASS**, then `npx vitest run src/lib src/infrastructure src/application src/components/diary` and update tests that counted `weeksAhead` weeks of tasks.
- [ ] **Step 5: Commit** — `git commit -m "feat: generate routine tasks only inside the rolling window" -- <paths>`

---

### Task 4: Startup top-up

**Files:**
- Modify: `src/infrastructure/repositories/dexie/taskRepository.ts` (add `extendSeries`)
- Modify: `src/infrastructure/repositories/dexie/studyRoutineRepository.ts` (add `extend`)
- Modify: `src/domain/ports/task.ts`, `src/domain/ports/studyRoutine.ts` (port signatures)
- Modify: `src/infrastructure/compositionRoot.ts` (`schedule: { extend: () => … }` inline, like `routines.update`)
- Create: `src/hooks/useScheduleTopUp.ts`; Modify: `src/components/AppShell.tsx:65` (call next to `useReminderSchedule`)
- Test: `src/infrastructure/repositories/dexie/repositories.test.ts`, `src/lib/services/studyRoutines.test.ts`

**Interfaces:**
- Consumes: `windowedRecurrenceDates` (Task 1), `generate`/`weekContext` (Task 3), `inheritTempoProgressions` + `tempoProgressionRepository.read` (existing, as in `taskRepository.carryOver`).
- Produces: `taskRepository.extendSeries(today: string): Promise<number>` (rows added); `studyRoutineRepository.extend(today: string): Promise<number>`; `application.schedule.extend(): Promise<void>` (both, `today()`); `useScheduleTopUp(): void` — runs on mount and on `visibilitychange` to visible, errors swallowed like `useReminderSchedule`.

`extendSeries` per root (`recurrence` set), inside one `rw` transaction over `tasks, tempoProgressions, studyRoutines, sessions, segments, library`, re-reading the root inside it:
- skip when `root.deletedAt` and no live child dated `>= today`;
- `after = root.materializedUntil ?? last live series date`; dates = `windowedRecurrenceDates(root.recurrence, after, today)`; none → return;
- template = latest live, non-customized series row (root included) minus `id, date, done, skipped, executionNotes, customized, recurrence, tempoRule, tempoRuleRevision, materializedUntil, deletedAt`; `recurrenceTaskId = root.id`, `createdAt = now()`; pass through `inheritTempoProgressions`;
- `bulkAdd`, then `root.materializedUntil = last date`.

`extend` per live routine: `fromDate = max(materializedUntil + 1, today)`; skip when `fromDate >= toDate` (Task 3 formula); `weekContext` then `generate`.

- [ ] **Step 1: Write failing tests** (fake time `2026-10-28`, then advance):
- daily series created on 10-28; advance to 11-04; `extendSeries` → last row `2026-11-18`, root `materializedUntil === "2026-11-18"`.
- call `extendSeries` twice in `Promise.all` → no duplicate `(recurrenceTaskId, date)`.
- delete (hard) the row on 11-11 before advancing → after `extendSeries`, still no row on 11-11.
- `removeSeries(root)` then advance → `extendSeries` adds 0. Soft-delete only the root (first day had a session) → still extends.
- interval 30 days from 10-20 → after advancing to 11-20, row `2026-12-19` exists.
- series importance changed to `"high"` on a child → new rows get `"high"`.
- accepted tempo progression state on the series → new rows carry its tempo (assert via the same helper `carryOver` tests use).
- routine: advance 7 days, `extend` → tasks up to the new window end; per-week count of each pool key `<= repetitionCap` across the boundary week; with `avoidBackToBack` no key on both the last old day and the first new day (pool ≥ 2).
- routine past `routineEnd` → `extend` adds 0.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/infrastructure/repositories/dexie/repositories.test.ts src/lib/services/studyRoutines.test.ts`
- [ ] **Step 3: Implement** repository methods, port lines, composition entry, hook.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: top up recurring and routine tasks on app open" -- <paths>`

---

### Task 5: Prune legacy rows (Dexie v19 and backup import)

**Files:**
- Create: `src/infrastructure/dexie/schedulePrune.ts`
- Modify: `src/infrastructure/dexie/db.ts` (add `this.version(19).stores({}).upgrade(tx => pruneSchedule(…tx.table(…), today()))` after v18)
- Modify: `src/infrastructure/repositories/dexie/backupRepository.ts:10-18` (call `pruneSchedule` at the end of the `importAll` transaction)
- Test: `src/infrastructure/dexie/migration.test.ts`, `src/application/useCases/backup.test.ts`

**Interfaces:**
- Produces: `pruneSchedule(t: { tasks: Table<Task>; sessions: Table<Session>; assignments: Table<Assignment>; studyRoutines: Table<StudyRoutine> }, today: string): Promise<number>` — deletes rows with `studyRoutineId !== undefined || recurrenceTaskId !== undefined`, no `recurrence`, `date >` their series' `scheduleWindowEnd(start, today)` (routine: `routine.startDate`; recurrence: root's `recurrence.startDate`), and none of: `done`, `skipped`, `customized`, `executionNotes`, a session with that `taskId`, presence in any `assignments.taskIds`. Then stamps `materializedUntil = scheduleWindowEnd(start, today)` on every live routine and recurrence root. Returns deleted count.

- [ ] **Step 1: Write failing tests**:
- migration test: seed a v18 DB with one daily series and one routine running to 2027, plus one far-future row of each protected kind (done, skipped, customized, executionNotes, with session, in `assignments.taskIds`) → after opening at v19 only window rows + the 6 protected rows remain beyond today; roots/routines stamped.
- backup test: `importAll` of that same data → same result.
- running `pruneSchedule` twice deletes 0 the second time.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/infrastructure/dexie/migration.test.ts src/application/useCases/backup.test.ts`
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: prune pre-generated future tasks beyond the window" -- <paths>`; update the v-list line in `CLAUDE.md` (Data Layer paragraph: "v19 prunes untouched future routine/recurrence tasks beyond the 14-day window") in the same commit.

---

### Task 6: Verify end to end

- [ ] `npx tsc --noEmit -p tsconfig.app.json` — no errors.
- [ ] `npm run lint` — clean.
- [ ] `npm run test` — all pass (known flake: `StudySetup.test.tsx` timeout, passes alone).
- [ ] `npm run build` — succeeds.
- [ ] Dev server (`npm run dev`), import `BU.json` in Profile, export again: file about 134 KB (measured estimate); Diary shows today's routine + series tasks; calendar shows tasks through today + 14 and nothing after except protected rows; advance system date one day / reopen → next day appears.
- [ ] Report sizes before/after to the user.
